import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type Mail from 'nodemailer/lib/mailer';
export type ResetMail = {from:string;to:string;subject:string;html:string;text:string};
export type ResetTransport = (message:ResetMail)=>Promise<{data:{id:string}|null;error:unknown}>;
type Environment = Readonly<Record<string,string|undefined>>;
type SMTPResult = {messageId?:string;accepted?:unknown[];rejected?:unknown[];pending?:unknown[];response?:string};
export type SMTPFactory = (options:SMTPTransport.Options)=>{sendMail:(message:Mail.Options)=>Promise<SMTPResult>};
const unavailable=()=>new Error('RESET_MAIL_UNAVAILABLE');
// Deliberately only a single canonical ASCII mailbox, never an RFC address list.
export function validResetRecipient(value:string) {
 return typeof value==='string' && value.length<=254 && value===value.trim().toLowerCase() && /^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value);
}
export function selectResetTransport(env:Environment,resend?:ResetTransport,createSMTP:SMTPFactory=options=>nodemailer.createTransport(options)):ResetTransport {
 try {
  const choice=env.PASSWORD_RESET_EMAIL_TRANSPORT ?? 'resend';
  if(choice==='resend') {if(!resend) throw unavailable();return resend;}
  if(choice!=='gmail') throw unavailable();
  const user=env.GMAIL_SMTP_USER ?? '',pass=env.GMAIL_SMTP_APP_PASSWORD ?? '';
  if(!validResetRecipient(user) || !/^[a-z0-9]+(?:\.[a-z0-9]+)*@gmail\.com$/.test(user) || !pass.trim() || /[\r\n]/.test(pass)) throw unavailable();
  const smtp=createSMTP({host:'smtp.gmail.com',port:465,secure:true,tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},auth:{user,pass},pool:false,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
  return async message=>{
   try {
    if(!validResetRecipient(message.to)) throw unavailable();
    const result=await smtp.sendMail({from:{name:'Cutting Edge Leads',address:user},to:{address:message.to},envelope:{from:user,to:[message.to]},subject:message.subject,html:message.html,text:message.text,disableFileAccess:true,disableUrlAccess:true});
    if(typeof result.messageId!=='string'||!result.messageId.trim()||result.accepted?.length!==1||result.accepted[0]!==message.to||!Array.isArray(result.rejected)||result.rejected.length|| (result.pending!==undefined && (!Array.isArray(result.pending)||result.pending.length)) || typeof result.response!=='string'||!/^250[ -]/.test(result.response)) throw unavailable();
    return {data:{id:result.messageId},error:null};
   }catch{throw unavailable();}
  };
 }catch{throw unavailable();}
}
