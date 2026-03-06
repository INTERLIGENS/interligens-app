// src/lib/solanaGraph/priorityStore.ts
import { InvestigationEntry, PriorityList, Priority, InvestigationEntryType } from "./types";
import * as fs from "fs/promises";
import * as path from "path";
const FILE=path.resolve(process.cwd(),"data/investigation/priority.json");
export async function readPriorityList(): Promise<PriorityList> { try{return JSON.parse(await fs.readFile(FILE,"utf-8"));}catch{return{entries:[],updated_at:new Date().toISOString()};} }
async function write(list: PriorityList): Promise<void> { try{await fs.mkdir(path.dirname(FILE),{recursive:true});await fs.writeFile(FILE,JSON.stringify(list,null,2),"utf-8");}catch(e){console.error("[priorityStore]",e);} }
export async function addEntry(input:{type:InvestigationEntryType;value:string;priority:Priority;note?:string}): Promise<InvestigationEntry> {
  const list=await readPriorityList();
  const e:InvestigationEntry={id:`inv_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,type:input.type,value:input.value,priority:input.priority,note:input.note,added_at:new Date().toISOString()};
  list.entries.push(e);list.updated_at=new Date().toISOString();await write(list);return e;
}
export async function removeEntry(id: string): Promise<boolean> {
  const list=await readPriorityList();const before=list.entries.length;list.entries=list.entries.filter(e=>e.id!==id);
  if(list.entries.length===before)return false;list.updated_at=new Date().toISOString();await write(list);return true;
}
export async function getHighPriorityEntries(): Promise<InvestigationEntry[]>{return(await readPriorityList()).entries.filter(e=>e.priority==="HIGH");}
