// src/lib/solanaGraph/scheduler.ts
import { GraphJob, Priority, HopsDepth, DaysWindow } from "./types";
import { cacheGetJob, cacheSetJob, cacheListGraphKeys } from "./cache";
import { buildGraphReport } from "./engine";
const memQueue: string[]=[];
export function createJob(query:{mint?:string;wallet?:string;hops?:HopsDepth;days?:DaysWindow},priority:Priority="NORMAL"): GraphJob {
  return{id:`job_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,created_at:new Date().toISOString(),status:"PENDING",priority,query:{mint:query.mint,wallet:query.wallet,hops:priority==="HIGH"?2:(query.hops??1),days:priority==="HIGH"?90:(query.days??30)}};
}
export async function enqueueJob(job: GraphJob): Promise<void> { await cacheSetJob(job); if(job.priority==="HIGH")memQueue.unshift(job.id);else memQueue.push(job.id); }
export async function processNextJob(): Promise<GraphJob|null> {
  const jid=memQueue.shift();if(!jid)return null;
  const job=await cacheGetJob(jid);if(!job||job.status!=="PENDING")return null;
  const running={...job,status:"RUNNING",started_at:new Date().toISOString(),progress:0};await cacheSetJob(running);
  try{const report=await buildGraphReport(job.query.mint,job.query.wallet,job.query.hops,job.query.days);const done={...running,status:"DONE",completed_at:new Date().toISOString(),result:report,progress:100};await cacheSetJob(done);return done;}
  catch(err){const failed={...running,status:"FAILED",completed_at:new Date().toISOString(),error:err instanceof Error?err.message:String(err),progress:0};await cacheSetJob(failed);return failed;}
}
export async function getJob(jobId: string): Promise<GraphJob|null>{return cacheGetJob(jobId);}
export interface QueueStatus{queued:number;job_ids:string[];cache_keys_count:number;}
export async function getQueueStatus(): Promise<QueueStatus>{const keys=await cacheListGraphKeys();return{queued:memQueue.length,job_ids:[...memQueue],cache_keys_count:keys.length};}
