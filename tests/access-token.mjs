import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {accessSettings,verifyAccessToken} from '../app/access-token.ts';
const issuer='https://test-team.cloudflareaccess.com',audience='test-audience';
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk=await exportJWK(publicKey);jwk.kid='test-key';
const keys=createLocalJWKSet({keys:[jwk]});
async function token(overrides={}){return new SignJWT({email:'admin@example.test',name:'Test Administrator',...overrides}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('test-user').setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('2m').sign(privateKey)}
const valid=await token();const user=await verifyAccessToken(valid,issuer,audience,keys);assert.equal(user.userId,'test-user');assert.equal(user.email,'admin@example.test');
await assert.rejects(verifyAccessToken(valid,issuer,'other-audience',keys));
await assert.rejects(verifyAccessToken(valid,'https://other-team.cloudflareaccess.com',audience,keys));
await assert.rejects(verifyAccessToken(await token({email:null}),issuer,audience,keys));
const expired=await new SignJWT({email:'admin@example.test'}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('test-user').setIssuer(issuer).setAudience(audience).setIssuedAt(1).setExpirationTime(2).sign(privateKey);
await assert.rejects(verifyAccessToken(expired,issuer,audience,keys));
const parts=valid.split('.');parts[1]=Buffer.from(JSON.stringify({email:'attacker@example.test',sub:'attacker',iss:issuer,aud:audience,exp:9999999999,iat:1})).toString('base64url');await assert.rejects(verifyAccessToken(parts.join('.'),issuer,audience,keys));
assert.throws(()=>accessSettings(undefined,audience));assert.throws(()=>accessSettings('http://test-team.cloudflareaccess.com',audience));assert.throws(()=>accessSettings('https://attacker.example/certs',audience));assert.throws(()=>accessSettings('https://test-team.cloudflareaccess.com/extra',audience));
console.log('PASS: Access token signature, issuer, audience, expiry, user identity, tampering, missing configuration and certificate-origin validation.');
