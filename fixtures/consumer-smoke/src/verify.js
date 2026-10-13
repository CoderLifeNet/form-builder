import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
const root = path.resolve(process.cwd(), "..", "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "form-consumer-"));
try {
  const names = ["core", "postgres", "server", "react", "builder"];
  const dependencies = Object.fromEntries(names.map(name => [`@coderlifenet/form-${name}`, `file:${path.join(root, "tmp/packs", `coderlifenet-form-${name}-0.1.0-alpha.0.tgz`)}`]));
  Object.assign(dependencies, { "@coderlifenet/ui-core": "0.2.0-alpha.0", "@coderlifenet/ui-components": "0.2.0-alpha.0", react: "19.2.8", "react-dom": "19.2.8", "@mui/material": "9.4.0", "@emotion/react": "11.14.0", "@emotion/styled": "11.14.1" });
  fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ private: true, type: "module", dependencies, devDependencies: { typescript: "5.9.3", "@types/react": "19.2.2", "@types/react-dom": "19.2.2" } }));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: directory, stdio: "inherit" });
  fs.writeFileSync(path.join(directory, "verify.mjs"), `
    import assert from 'node:assert/strict';
    import React from 'react';
    import { renderToString } from 'react-dom/server';
    import { Button, ThemeProvider, createTheme } from '@coderlifenet/ui-core';
    import { TrackingBoundary, UIExtensionsProvider } from '@coderlifenet/ui-core/extensions';
    import { knownUIEventTypes } from '@coderlifenet/ui-core/instrumentation';
    import { supportedTrackingEvents, validateDefinition } from '@coderlifenet/form-core';
    import { FormRenderer } from '@coderlifenet/form-react';
    import { FormManager } from '@coderlifenet/form-builder';
    import { DataTable } from '@coderlifenet/ui-components';
    assert.equal(typeof DataTable, 'function');
    assert.deepEqual([...supportedTrackingEvents].sort(), [...knownUIEventTypes].sort());
    const definition = validateDefinition({metadata:{formId:'f',name:'Consumer'}, sections:[], fields:[]});
    const html = renderToString(React.createElement(ThemeProvider,{theme:createTheme()},React.createElement(UIExtensionsProvider,{},React.createElement(TrackingBoundary,{id:'app'},React.createElement(FormRenderer,{definition,mode:'new'}),React.createElement(Button,{},'Save')))));
    assert.match(html,/MuiButton/);
    assert.match(html,/Consumer/);
    assert.equal(typeof FormManager, 'function');
    console.log('Installed packed form packages with exact registry UI pair; exports, catalog and SSR renderer/theme passed.');
  `);
  fs.writeFileSync(path.join(directory, "types.tsx"), `
    import { FormRenderer, type FormRendererProps } from '@coderlifenet/form-react';
    import { FormBuilder } from '@coderlifenet/form-builder';
    import { TrackingBoundary } from '@coderlifenet/ui-core/extensions';
    import { DataTable } from '@coderlifenet/ui-components';
    const props: FormRendererProps = { definition: { metadata:{formId:'f',name:'F',schemaVersion:'1.0.0'},fields:[],sections:[],dependencyVersions:{} }, mode:'new' };
    const element = <TrackingBoundary id="consumer" events={[]}><FormRenderer {...props} /></TrackingBoundary>;
    void [element, FormBuilder, DataTable];
  `);
  execFileSync(path.join(directory, "node_modules/.bin/tsc"), ["--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--jsx", "react-jsx", "--target", "ES2022", "types.tsx"], { cwd: directory, stdio: "inherit" });
  execFileSync(process.execPath, ["verify.mjs"], { cwd: directory, stdio: "inherit" });
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
