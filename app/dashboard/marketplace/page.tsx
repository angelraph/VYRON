import { getAgents } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { MarketplaceGrid } from "@/components/marketplace/marketplace-grid";

export default async function MarketplacePage() {
  const agents = await getAgents();

  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Browse specialized Agent Service Providers by rating, price, and availability."
      />
      <MarketplaceGrid agents={agents} />
    </div>
  );
}
