import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
const root = path.resolve(process.cwd(), "..", "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "form-consumer-"));
try {
  const dependencies = {
    "@coderlifenet/form-builder": `file:${path.join(root, "tmp/packs", "coderlifenet-form-builder-0.1.0-alpha.0.tgz")}`,
    "@coderlifenet/ui-core": "0.2.0-alpha.0",
    "@coderlifenet/ui-components": "0.2.0-alpha.0",
    react: "19.2.8",
    "react-dom": "19.2.8",
    "@mui/material": "9.4.0",
    "@emotion/react": "11.14.0",
    "@emotion/styled": "11.14.1"
  };
  fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ private: true, type: "module", dependencies, devDependencies: { typescript: "5.9.3", "@types/react": "19.2.2", "@types/react-dom": "19.2.2" } }));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: directory, stdio: "inherit" });
  fs.writeFileSync(path.join(directory, "verify.mjs"), `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import path from 'node:path';
    import React from 'react';
    import { renderToString } from 'react-dom/server';
    import { Button, ThemeProvider, createTheme } from '@coderlifenet/ui-core';
    import { TrackingBoundary, UIExtensionsProvider } from '@coderlifenet/ui-core/extensions';
    import { knownUIEventTypes } from '@coderlifenet/ui-core/instrumentation';
    import { FormBuilder, FormManager, exportDefinition, importDefinition } from '@coderlifenet/form-builder/builder';
    import { FormRenderer, RecordHistoryView, createFormApiClient, createMutationRetryKey, createHttpUploadHandler } from '@coderlifenet/form-builder/renderer';
    import { supportedTrackingEvents, validateDefinition, createStableId } from '@coderlifenet/form-builder/core';
    import { createFormServer } from '@coderlifenet/form-builder/server';
    import { FormRepository, MigrationRunner, makePool } from '@coderlifenet/form-builder/postgres';
    import { DataTable } from '@coderlifenet/ui-components';

    assert.equal(typeof FormBuilder, 'function');
    assert.equal(typeof FormManager, 'function');
    assert.equal(typeof FormRenderer, 'function');
    assert.equal(typeof RecordHistoryView, 'function');
    assert.equal(typeof createFormApiClient, 'function');
    assert.equal(typeof createMutationRetryKey, 'function');
    assert.equal(typeof createHttpUploadHandler, 'function');
    assert.equal(typeof createFormServer, 'function');
    assert.equal(typeof FormRepository, 'function');
    assert.equal(typeof MigrationRunner, 'function');
    assert.equal(typeof makePool, 'function');
    assert.equal(typeof createStableId, 'function');
    assert.equal(typeof exportDefinition, 'function');
    assert.equal(typeof importDefinition, 'function');

    assert.equal(typeof DataTable, 'function');
    assert.deepEqual([...supportedTrackingEvents].sort(), [...knownUIEventTypes].sort());

    const definition = validateDefinition({metadata:{formId:'f',name:'Consumer'}, sections:[], fields:[]});
    const html = renderToString(React.createElement(ThemeProvider,{theme:createTheme()},React.createElement(UIExtensionsProvider,{},React.createElement(TrackingBoundary,{id:'app'},React.createElement(FormRenderer,{definition,mode:'new'}),React.createElement(Button,{},'Save')))));
    assert.match(html,/MuiButton/);
    assert.match(html,/Consumer/);

    const rendererEntry = path.join(process.cwd(), 'node_modules', '@coderlifenet', 'form-builder', 'dist', 'renderer', 'index.js');
    const rendererCode = fs.readFileSync(rendererEntry, 'utf8');
    assert(!rendererCode.includes('from "express"'), 'renderer import graph must stay browser-safe and not pull express');
    assert(!rendererCode.includes('from "pg"'), 'renderer import graph must stay browser-safe and not pull pg');
    assert(!rendererCode.includes('/storage/'), 'renderer import graph must not include storage providers');

    const app = createFormServer({ repository: {} });
    const server = app.listen(0);
    const address = server.address();
    assert(address && typeof address === 'object');
    const response = await fetch('http://127.0.0.1:' + address.port + '/health');
    assert.equal(response.status, 200);
    server.close();

    console.log('Installed only form-builder tarball plus declared peers/dependencies; verified exports, types, browser-server separation, theme/analytics composition, and backend mount health.');
  `);
  fs.writeFileSync(path.join(directory, "types.tsx"), `
    import { FormBuilder, type ManagedForm } from '@coderlifenet/form-builder/builder';
    import { FormRenderer, type FormRendererProps } from '@coderlifenet/form-builder/renderer';
    import { type FormDefinition } from '@coderlifenet/form-builder/core';
    import { type PolicyAdapter } from '@coderlifenet/form-builder/server';
    import { type DbContext } from '@coderlifenet/form-builder/postgres';
    import { TrackingBoundary } from '@coderlifenet/ui-core/extensions';
    import { DataTable } from '@coderlifenet/ui-components';
    const definition: FormDefinition = { metadata:{formId:'f',name:'F',schemaVersion:'1.0.0'}, fields:[], sections:[], dependencyVersions:{} };
    const props: FormRendererProps = { definition, mode:'new' };
    const managed: ManagedForm = { id:'f', name:'Form', archived:false, hasUnpublishedChanges:true, definition };
    const policy: PolicyAdapter = { resolveContext: async () => ({ tenantId:'t', actorId:'a', isAnonymous:false }), authorize: async () => ({ allowed:true, capabilities:[] }) };
    const ctx: DbContext = { tenantId:'t', actorId:'a' };
    const element = <TrackingBoundary id="consumer" events={[]}><FormRenderer {...props} /></TrackingBoundary>;
    void [element, FormBuilder, DataTable, managed, policy, ctx];
  `);
  execFileSync(path.join(directory, "node_modules/.bin/tsc"), ["--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--jsx", "react-jsx", "--target", "ES2022", "types.tsx"], { cwd: directory, stdio: "inherit" });
  execFileSync(process.execPath, ["verify.mjs"], { cwd: directory, stdio: "inherit" });
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
