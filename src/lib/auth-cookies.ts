export function isSessionCookie(name: string, base: string) {
 return name===base || (name.startsWith(base+'.') && /^\d+$/.test(name.slice(base.length+1)));
}
export function sessionCookiePolicy(lines: string[], name: string, claims: {remember?:boolean;deadline?:number}|null) {
 return lines.map(line=>{
  const parts=line.split(';');const pair=parts[0];const eq=pair.indexOf('=');
  if(!isSessionCookie(pair.slice(0,eq),name)) return line;
  // Keep NextAuth's deletion cookies, including chunk cleanup.
  if(!pair.slice(eq+1) || parts.some(p=>/^\s*Max-Age=0\s*$/i.test(p))) return line;
  const flags=parts.slice(1).filter(p=>!/^\s*(Expires|Max-Age)=/i.test(p));
  if(!claims || !claims.deadline || claims.deadline*1000<=Date.now()) return [pair.slice(0,eq)+'=',...flags,' Max-Age=0'].join(';');
  if(claims.remember) flags.push(' Expires='+new Date(claims.deadline*1000).toUTCString());
  return [pair,...flags].join(';');
 });
}
