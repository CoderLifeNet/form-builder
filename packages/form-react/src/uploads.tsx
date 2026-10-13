import { useRef, useState, useEffect } from "react";
import { Button, Stack, Typography, LinearProgress, FormHelperText } from "@coderlifenet/ui-core";
export type UploadHandler = (fieldId: string, file: File, signal: AbortSignal, progress: (percent: number) => void) => Promise<string>;
export function FileField({ id, label, multiple, disabled, required, value, error, upload, onChange }: { id:string; label:string; multiple:boolean; disabled:boolean; required:boolean; value:unknown; error?:string; upload?:UploadHandler; onChange:(value:unknown)=>void }) {
 const [pending,setPending]=useState<Array<{file:File;percent:number;error?:string}>>([]);
 const controllers=useRef(new Map<File,AbortController>());
 const selected=Array.isArray(value)?value.map(String):value?[String(value)]:[];
 const currentSelected = useRef(selected);
 currentSelected.current = selected;
 useEffect(() => () => { for (const controller of controllers.current.values()) controller.abort(); }, []);
 const start=async(file:File)=>{
  if(!upload)return;
  const controller=new AbortController();controllers.current.set(file,controller);
  setPending(previous=>[...previous.filter(item=>item.file!==file),{file,percent:0}]);
  try {
   const uploadId=await upload(id,file,controller.signal,percent=>setPending(previous=>previous.map(item=>item.file===file?{...item,percent}:item)));
   if(controller.signal.aborted)return;
   const next = multiple ? [...currentSelected.current,uploadId] : [uploadId];
   currentSelected.current = next;
   onChange(multiple ? next : uploadId);
   setPending(previous=>previous.filter(item=>item.file!==file));
  } catch {
   if(!controller.signal.aborted)setPending(previous=>previous.map(item=>item.file===file?{...item,error:"Upload failed. Retry available."}:item));
  } finally {controllers.current.delete(file);}
 };
 return <Stack spacing={1}>
  <Typography component="label" htmlFor={id}>{label}{required?" *":""}</Typography>
  <input id={id} type="file" multiple={multiple} disabled={disabled||!upload||pending.some(item=>!item.error)} aria-required={required} aria-invalid={Boolean(error)} aria-describedby={`${id}-help`} onChange={event=>{void (async()=>{for(const file of Array.from(event.target.files??[]))await start(file);})();}} />
  {!upload&&<Typography>Connect an upload handler to enable file selection.</Typography>}
  {pending.map((item,index)=><Stack key={index}><LinearProgress variant="determinate" value={item.percent} aria-label="Upload progress" />{item.error&&<Typography role="alert">{item.error}</Typography>}<Button disabled={disabled} onClick={()=>{controllers.current.get(item.file)?.abort();setPending(previous=>previous.filter(candidate=>candidate.file!==item.file));}}>Cancel upload</Button>{item.error&&<Button disabled={disabled} onClick={()=>void start(item.file)}>Retry upload</Button>}</Stack>)}
  {selected.map((uploadId,index)=><Stack key={uploadId} direction="row"><Typography>Attached file {index+1}</Typography><Button disabled={disabled} onClick={()=>onChange(multiple?selected.filter(id=>id!==uploadId):undefined)}>Remove file {index+1}</Button></Stack>)}
  <FormHelperText id={`${id}-help`} error={Boolean(error)}>{error??"Files remain private; submitting attaches completed uploads."}</FormHelperText>
 </Stack>;
}
// Uses host authentication cookies; configurable API base. Metadata stays server-side.
export function createHttpUploadHandler(apiBase: string, formId: string, definitionId: string): UploadHandler {
 return (fieldId,file,signal,progress)=>new Promise((resolve,reject)=>{
  const request=new XMLHttpRequest();
  request.open("POST",`${apiBase}/api/forms/${encodeURIComponent(formId)}/uploads?fieldId=${encodeURIComponent(fieldId)}&definitionId=${encodeURIComponent(definitionId)}`);
  request.withCredentials=true;request.setRequestHeader("content-type","application/octet-stream");request.setRequestHeader("x-file-name",file.name);request.setRequestHeader("x-file-content-type",file.type||"application/octet-stream");
  request.upload.onprogress=event=>{if(event.lengthComputable)progress(event.loaded/event.total*100);};
  const abort=()=>request.abort();signal.addEventListener("abort",abort,{once:true});
  const finish=()=>signal.removeEventListener("abort",abort);
  request.onload=()=>{finish();if(request.status>=200&&request.status<300){try{resolve(JSON.parse(request.responseText).uploadId);}catch{reject(new Error("Invalid upload response"));}}else reject(new Error("Upload rejected"));};
  request.onerror=()=>{finish();reject(new Error("Upload failed"));};request.onabort=()=>{finish();reject(new Error("Upload canceled"));};
  if(signal.aborted){reject(new Error("Upload canceled"));return;}
  request.send(file);
 });
}
