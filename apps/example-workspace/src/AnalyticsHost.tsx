import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createAnalyticsRuntime, createMemoryAdapter } from "@coderlifenet/ui-core/analytics";
import { TrackingBoundary, UIExtensionsProvider, createAnalyticsExtension } from "@coderlifenet/ui-core/extensions";
import { FormControlLabel, Paper, Stack, Switch, Typography } from "@coderlifenet/ui-core";

// Host-owned, opt-in example. Embedded libraries never create a provider.
type AnalyticsHostProps = {
  children: ReactNode;
  adapters?: Parameters<typeof createAnalyticsRuntime>[0];
};

export function AnalyticsHost({ children, adapters }: AnalyticsHostProps) {
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const memory = useMemo(() => createMemoryAdapter(), []);
  const runtime = useMemo(() => createAnalyticsRuntime(adapters ?? [memory], { enabled: false, consent: { analyticsStorage: "denied", adStorage: "denied" } }), [adapters, memory]);
  const extensions = useMemo(() => [createAnalyticsExtension(runtime)], [runtime]);
  useEffect(() => { runtime.update({ enabled, consent: { analyticsStorage: consent ? "granted" : "denied", adStorage: "denied" } }); }, [enabled, consent, runtime]);
  return <UIExtensionsProvider initialConfig={{ enabled: true }} extensions={extensions}>
    <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5 }}>
      <Typography variant="subtitle2">Demo tools: analytics runtime</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
        Host-controlled analytics enablement and consent for this example shell.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }}>
        <FormControlLabel label="Enable example analytics" control={<Switch checked={enabled} onChange={(_, value) => setEnabled(value)} />} />
        <FormControlLabel label="Grant analytics consent" control={<Switch checked={consent} onChange={(_, value) => setConsent(value)} />} />
      </Stack>
    </Paper>
    <TrackingBoundary id="example-app">{children}</TrackingBoundary>
  </UIExtensionsProvider>;
}
