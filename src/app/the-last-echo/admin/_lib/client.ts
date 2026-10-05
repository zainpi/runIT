import {createBrowserClient} from "@supabase/ssr";
import {ADMIN_SESSION_KEY,decodeAdminSession,gameHeaders,type SessionStore} from "./release-contract";
let sessionGeneration = 0;
export const adminSessionStore: SessionStore = {
 read() {try{return typeof window === "undefined" ? null : decodeAdminSession(window.sessionStorage.getItem(ADMIN_SESSION_KEY));}catch{return null;}},
 write(value) {try{window.sessionStorage.setItem(ADMIN_SESSION_KEY,JSON.stringify(value));}catch{throw new Error("Allow session storage before using the dashboard.");}},
 generation() {return sessionGeneration;},
 clear() {sessionGeneration+=1;try{if(typeof window !== "undefined")window.sessionStorage.removeItem(ADMIN_SESSION_KEY);}catch{/* unavailable storage already reads as no current context */}},
};
/** Game-only client. Never reuse the site's default browser singleton or headers. */
export function createClient() {
 return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  isSingleton:false,global:{headers:gameHeaders(adminSessionStore.read())},
 });
}
