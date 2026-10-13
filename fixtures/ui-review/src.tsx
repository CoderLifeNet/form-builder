import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, Button, Stack, Container, Typography } from "@coderlifenet/ui-core";
import { FormBuilder, FormManager } from "@coderlifenet/form-builder/builder";
import { FormRenderer, RecordHistoryView } from "@coderlifenet/form-builder/renderer";
import { validateDefinition } from "@coderlifenet/form-builder/core";
const initial = validateDefinition({ metadata:{formId:"review",name:"Review form"}, sections:[{id:"details",title:"Details",order:0}], fields:[{id:"name",key:"name",label:"Name",type:"text",sectionId:"details",row:0,width:6,required:true}] });
function Review() {
 const [view,setView]=useState("manager");
 const [definition,setDefinition]=useState(initial);
 return <><CssBaseline/><Container><Typography component="h1" variant="h4">UI verification fixture</Typography><Stack direction="row">{["manager","builder","capture","history"].map(v=><Button key={v} onClick={()=>setView(v)}>{v}</Button>)}</Stack>
 <div hidden={view!=="manager"}><FormManager forms={[{id:"review",name:"Review form",archived:false,hasDraft:true,definition}]} onOpenBuilder={()=>setView("builder")} onCreateForm={()=>setView("builder")} onDuplicate={()=>{}} onExport={()=>{}} onArchiveToggle={()=>{}} onImportAsNew={()=>{}} /></div>
 <div hidden={view!=="builder"}><FormBuilder initialDefinition={initial} onDefinitionChange={setDefinition} onSaveDraft={async()=>{}} onPublish={async()=>{}} onSaved={()=>setView("manager")} /></div>
 {view==="capture"&&<FormRenderer definition={definition} mode="new" onSubmit={async()=>{}} />}
 {view==="history"&&<RecordHistoryView definition={definition} revisions={[{id:"revision",revisionNumber:1,savedAt:"2026-10-13T00:00:00Z",values:{name:"Example"},definition:initial}]} />}
 </Container></>;
}
createRoot(document.getElementById("root")!).render(<Review/>);
