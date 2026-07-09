import { getCurrentUser } from "@/lib/auth";
import { getAgents, getUserPreferences } from "@/lib/db";
import { getIntegrationStatuses } from "@/lib/integrations";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { IntegrationStatusCard } from "@/components/settings/integration-status";
import { WalletConnect } from "@/components/settings/wallet-connect-button";
import { PreferencesForm } from "@/components/settings/preferences-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const [statuses, preferences, agents] = await Promise.all([
    getIntegrationStatuses(),
    getUserPreferences(user.id),
    getAgents(),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Your account, integrations, and how VYRON remembers you."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card className="glass border-0 py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-medium">Account</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3 px-5">
              <Avatar className="size-12 border border-border">
                <AvatarFallback className="bg-gradient-brand text-primary-foreground">
                  {user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-muted-foreground text-sm">{user.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-0 py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-medium">
                Wallet & settlement
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <p className="text-muted-foreground mb-4 text-sm">
                Connect a wallet on X Layer Testnet. Escrow settlement itself
                is still simulated — this is the real wallet layer it will
                settle through.
              </p>
              <WalletConnect persistedAddress={preferences.walletAddress} />
            </CardContent>
          </Card>

          <IntegrationStatusCard statuses={statuses} />
        </div>

        <PreferencesForm preferences={preferences} agents={agents} />
      </div>
    </div>
  );
}
