import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createAnalyticsRuntime, createMemoryAdapter } from "@coderlifenet/ui-core/analytics";
import { TrackingBoundary, UIExtensionsProvider, createAnalyticsExtension } from "@coderlifenet/ui-core/extensions";
import { FormControlLabel, Switch, Stack } from "@coderlifenet/ui-core";

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
    <Stack direction="row"><FormControlLabel label="Enable example analytics" control={<Switch checked={enabled} onChange={(_, value) => setEnabled(value)} />} /><FormControlLabel label="Grant analytics consent" control={<Switch checked={consent} onChange={(_, value) => setConsent(value)} />} /></Stack>
    <TrackingBoundary id="example-app">{children}</TrackingBoundary>
  </UIExtensionsProvider>;
}
