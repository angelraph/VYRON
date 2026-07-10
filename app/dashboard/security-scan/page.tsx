import { PageHeader } from "@/components/dashboard/page-header";
import { SecurityScanForm } from "@/components/dashboard/security-scan-form";

export default function SecurityScanPage() {
  return (
    <div>
      <PageHeader
        title="Honeypot & Rug Risk Scanner"
        description="Real on-chain risk data first (OKX's own token-scan), then a real, independently-verified plain-English verdict — the same service listed as VYRON's ASP on OKX.AI."
      />
      <SecurityScanForm />
    </div>
  );
}
