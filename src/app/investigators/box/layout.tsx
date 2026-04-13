import FeedbackButton from "@/components/vault/FeedbackButton";
import { VaultToastProvider } from "@/components/vault/VaultToast";

export default function InvestigatorsBoxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultToastProvider>
      {children}
      <FeedbackButton />
    </VaultToastProvider>
  );
}
