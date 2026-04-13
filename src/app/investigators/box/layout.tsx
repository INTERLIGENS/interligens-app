import FeedbackButton from "@/components/vault/FeedbackButton";

export default function InvestigatorsBoxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <FeedbackButton />
    </>
  );
}
