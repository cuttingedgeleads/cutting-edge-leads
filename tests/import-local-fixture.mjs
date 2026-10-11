import {PrismaClient} from '@prisma/client';
export const database='postgresql://handoff_qa@127.0.0.1:55581/ce_leads_handoff_qa';
export const email='import-qa@example.invalid';
export function guard(){if(process.env.DATABASE_URL!==database)throw Error('EXCLUSIVE_DATABASE_GUARD');}
export async function cleanup(){guard();const db=new PrismaClient();try{const audit=await db.auditLog.deleteMany({where:{email}});if(audit.count)console.log('Removed exact fixture audit rows',audit.count);const normal=await db.lead.findMany({where:{email,description:'Synthetic normal form regression fixture'},select:{id:true}});if(normal.length){await db.leadPhoto.deleteMany({where:{leadId:{in:normal.map(r=>r.id)}}});await db.lead.deleteMany({where:{id:{in:normal.map(r=>r.id)}}});}const user=await db.user.findUnique({where:{email}});if(!user)return;
 const rows=await db.studioImport.findMany({where:{recipientId:user.id}});
 if(rows.some(r=>r.source!=='command-studio'||r.environment!=='qa'))throw Error('NON_QA_RECORD_GUARD');
 const ids=rows.flatMap(r=>r.leadId?[r.leadId]:[]);
 await db.$transaction(async tx=>{await tx.studioImport.deleteMany({where:{recipientId:user.id}});await tx.leadPhoto.deleteMany({where:{leadId:{in:ids}}});await tx.lead.deleteMany({where:{id:{in:ids}}});await tx.leadAuthSession.deleteMany({where:{userId:user.id}});await tx.user.delete({where:{id:user.id}});});console.log('Removed exact owned fixture',email,'imports',rows.length,'linked leads',ids.length);
 }finally{await db.$disconnect();}}
