/**
 * Trusted Contributor eligibility checker.
 *
 * Evaluates 8 objective criteria against an InvestigatorProfile. All 8 must
 * be met simultaneously for eligibility. The check is deterministic and
 * reusable from any admin route or dashboard.
 */

import { prisma } from "@/lib/prisma";

const REQUIRED_WORKSPACE_DAYS = 21;
const REQUIRED_ACTIVE_DAYS = 5;
const REQUIRED_CASES_CREATED = 2;

export type CriterionResult = {
  met: boolean;
  value?: number;
  required?: number;
};

export type EligibilityResult = {
  eligible: boolean;
  criteria: {
    workspaceDays: CriterionResult;
    activeDays: CriterionResult;
    casesCreated: CriterionResult;
    substantiveContribution: CriterionResult;
    noTrustIncident: CriterionResult;
    identityComplete: CriterionResult;
    ndaSigned: CriterionResult;
    termsSigned: CriterionResult;
  };
};

export async function checkTrustedContributorEligibility(
  profileId: string
): Promise<EligibilityResult> {
  const profile = await prisma.investigatorProfile.findUnique({
    where: { id: profileId },
    include: {
      ndaAcceptance: true,
      betaTermsAcceptance: true,
    },
  });

  if (!profile) {
    return {
      eligible: false,
      criteria: {
        workspaceDays: { met: false, value: 0, required: REQUIRED_WORKSPACE_DAYS },
        activeDays: { met: false, value: 0, required: REQUIRED_ACTIVE_DAYS },
        casesCreated: { met: false, value: 0, required: REQUIRED_CASES_CREATED },
        substantiveContribution: { met: false },
        noTrustIncident: { met: false },
        identityComplete: { met: false },
        ndaSigned: { met: false },
        termsSigned: { met: false },
      },
    };
  }

  // 1. workspaceDays — diff between now and workspaceActivatedAt in days
  let workspaceDaysValue = 0;
  if (profile.workspaceActivatedAt) {
    workspaceDaysValue = Math.floor(
      (Date.now() - profile.workspaceActivatedAt.getTime()) /
        (1000 * 60 * 60 * 24)
    );
  }
  const workspaceDays: CriterionResult = {
    met: workspaceDaysValue >= REQUIRED_WORKSPACE_DAYS,
    value: workspaceDaysValue,
    required: REQUIRED_WORKSPACE_DAYS,
  };

  // 2. activeDays — distinct calendar days with any activity event
  const activityRows = await prisma.investigatorActivityLog.findMany({
    where: { profileId },
    select: { createdAt: true },
  });
  const uniqueDates = new Set(
    activityRows.map((r) => r.createdAt.toISOString().slice(0, 10))
  );
  const activeDays: CriterionResult = {
    met: uniqueDates.size >= REQUIRED_ACTIVE_DAYS,
    value: uniqueDates.size,
    required: REQUIRED_ACTIVE_DAYS,
  };

  // 3. casesCreated — CASE_CREATED events in activity log
  const caseCreatedCount = await prisma.investigatorActivityLog.count({
    where: { profileId, event: "CASE_CREATED" },
  });
  const casesCreated: CriterionResult = {
    met: caseCreatedCount >= REQUIRED_CASES_CREATED,
    value: caseCreatedCount,
    required: REQUIRED_CASES_CREATED,
  };

  // 4. substantiveContribution — manually set by admin only
  const substantiveContribution: CriterionResult = {
    met: profile.substantiveContribution === true,
  };

  // 5. noTrustIncident — no suspend/revoke audit events AND state is ACTIVE
  const incidentCount = await prisma.investigatorProgramAuditLog.count({
    where: {
      profileId,
      event: { in: ["ACCESS_SUSPENDED", "ACCESS_REVOKED"] },
    },
  });
  const noTrustIncident: CriterionResult = {
    met: incidentCount === 0 && profile.accessState === "ACTIVE",
  };

  // 6. identityComplete — legal name provided
  const identityComplete: CriterionResult = {
    met: !!profile.legalFirstName && !!profile.legalLastName,
  };

  // 7. ndaSigned
  const ndaSigned: CriterionResult = {
    met: !!profile.ndaAcceptance,
  };

  // 8. termsSigned
  const termsSigned: CriterionResult = {
    met: !!profile.betaTermsAcceptance,
  };

  const criteria = {
    workspaceDays,
    activeDays,
    casesCreated,
    substantiveContribution,
    noTrustIncident,
    identityComplete,
    ndaSigned,
    termsSigned,
  };

  const eligible = Object.values(criteria).every((c) => c.met);

  return { eligible, criteria };
}
