import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importFormData } from '../src/lib/import-form-prefill';
import type { ImportPayload } from '../src/lib/import-wire';
const source = (overrides: Partial<ImportPayload> = {}) => ({
 customerName:'QA',customerEmail:'qa@example.invalid',customerPhone:'5550101234',
 address:'123 Synthetic Street',formattedAddress:'',city:'',state:'LA',postalCode:'70001',
 inquiryNotes:'Inquiry',estimatorNotes:'Estimator',salesNotes:'Sales',...overrides,
} as ImportPayload);
test('saved review preserves multipart destination and nonempty description edits verbatim',()=>{
 const reviewed={name:'Reviewed',address:'456 Reviewed Street, Building B, Apt 4',city:'Kenner',description:'Owner-reviewed description\nDo not replace.',unlockLimit:'2'};
 const before=JSON.stringify(reviewed);const actual=importFormData(source(),reviewed);
 assert.deepEqual(actual,reviewed);assert.equal(JSON.stringify(reviewed),before);
});
test('a saved blank description prefills transferred notes without rewriting the saved review',()=>{
 const p=source({inquiryNotes:'Inquiry\n第二行',estimatorNotes:'Estimator',salesNotes:'Sales'});
 const reviewed=Object.freeze({name:'Reviewed',address:'456 Reviewed Street, Building B, Apt 4',city:'Kenner',description:'',unlockLimit:'2'});
 const before=JSON.stringify(p);const actual=importFormData(p,reviewed);
 assert.deepEqual(actual,{...reviewed,description:'Inquiry\n第二行\n\nEstimator\n\nSales'});
 assert.equal(reviewed.description,'');assert.equal(JSON.stringify(p),before);
 assert.equal(importFormData(p,{unlockLimit:'2'}).description,actual.description);
});
test('saved descriptions remain empty without source notes and nonempty values stay verbatim',()=>{
 const emptySource=source({inquiryNotes:'',estimatorNotes:'',salesNotes:''});
 assert.equal(importFormData(emptySource,{description:'',unlockLimit:'1'}).description,'');
 assert.equal(importFormData(source(),{description:'  ',unlockLimit:'1'}).description,'  ');
});
test('locality and country prefixes are not apartment designators',()=>{
 for(const city of ['Sterling','Aptos','Stewartstown']){
  const actual=importFormData(source({formattedAddress:`123 Synthetic Street, ${city}, VA 20164, USA`}),null);
  assert.equal(actual.address,'123 Synthetic Street');assert.equal(actual.city,city);
 }
 const noCity=importFormData(source({formattedAddress:'123 Synthetic Street, United States'}),null);
 assert.equal(noCity.address,'123 Synthetic Street');assert.equal(noCity.city,'');
});
test('comma-less mailing lines use structured city and postal data without destroying street names',()=>{
 for(const state of ['LA','Louisiana']){
  const actual=importFormData(source({address:`123 Synthetic Street Metairie ${state} 70001 USA`,city:'Metairie'}),null);
  assert.equal(actual.address,'123 Synthetic Street');assert.equal(actual.city,'Metairie');
 }
 const actual=importFormData(source({address:'100 Metairie Road',city:'Metairie'}),null);
 assert.equal(actual.address,'100 Metairie Road');
});
test('known locality separates freeform street details and complete unit tokens',()=>{
 for(const unit of ['Apt 4','Apt4','Ste 5','Suite#5','Building B','Floor 2']){
  const actual=importFormData(source({address:`123 Synthetic Street, ${unit}, Metairie, LA 70001, USA`,city:'Metairie'}),null);
  assert.equal(actual.address,`123 Synthetic Street, ${unit}`);assert.equal(actual.city,'Metairie');
 }
});

test('partially comma-delimited mailing lines still separate street and locality',()=>{
 for(const address of ['123 Synthetic Street Metairie LA 70001, USA','123 Synthetic Street Metairie Louisiana 70001, United States']){
  const actual=importFormData(source({address,city:'Metairie'}),null);
  assert.equal(actual.address,'123 Synthetic Street');assert.equal(actual.city,'Metairie');
 }
 for(const address of ['123 Synthetic Street, Metairie LA 70001, USA','123 Synthetic Street, Metairie Louisiana 70001 USA']){
  const actual=importFormData(source({address}),null);
  assert.equal(actual.address,'123 Synthetic Street');assert.equal(actual.city,'Metairie');
 }
 const namedLikeState=importFormData(source({address:'123 Synthetic Street, New York, NY 10001, USA',state:'NY',postalCode:'10001'}),null);
 assert.equal(namedLikeState.city,'New York');
});

test('already-separated street and building names are never reinterpreted as locality suffixes',()=>{
 const cases=[
  {address:'123 Broadway, Broadway, VA 22815, USA',city:'Broadway',state:'VA',postalCode:'22815',expected:'123 Broadway'},
  {address:'123 Synthetic Street, Building Metairie, Metairie, LA 70001, USA',city:'Metairie',expected:'123 Synthetic Street, Building Metairie'},
  {address:'123 Synthetic Street, Unit Metairie, Metairie, LA 70001, USA',city:'Metairie',expected:'123 Synthetic Street, Unit Metairie'},
  {address:'123 Broadway',city:'Broadway',state:'VA',postalCode:'22815',expected:'123 Broadway'},
  {address:'123 Broadway Broadway VA 22815, USA',city:'Broadway',state:'VA',postalCode:'22815',expected:'123 Broadway'},
 ];
 for(const {expected,...overrides} of cases)assert.equal(importFormData(source(overrides),null).address,expected);
});

test('postal context survives comma and line boundaries without guessing ambiguous bare streets',()=>{
 for(const address of ['123 Synthetic Street\nMetairie, LA 70001, USA','123 Synthetic Street Metairie, LA 70001, USA','123 Synthetic Street\r\nMetairie\r\nLA 70001\r\nUSA']){
  const actual=importFormData(source({address,city:'Metairie'}),null);
  assert.equal(actual.address,'123 Synthetic Street');assert.equal(actual.city,'Metairie');
 }
 for(const address of ['123 Broadway, VA 22815, USA','123 South Broadway, VA 22815, USA']){
  const actual=importFormData(source({address,city:'Broadway',state:'VA',postalCode:'22815'}),null);
  assert.equal(actual.address,address.split(',')[0]);
 }
 const unit=importFormData(source({address:'123 Synthetic Street, Building Metairie, LA 70001, USA',city:'Metairie'}),null);
 assert.equal(unit.address,'123 Synthetic Street, Building Metairie');
});

test('ambiguous city names never remove trailing street directions or street-type words',()=>{
 for(const city of ['West','East','North','South','North East','Southwest','N','S','E','W','NE','NW','SE','SW','N.W.','Lane','Circle']){
  for(const address of [`123 Main Street ${city}, TX 76691, USA`,`123 Main Street ${city} TX 76691 USA`]){
   const actual=importFormData(source({address,city,state:'TX',postalCode:'76691'}),null);
   assert.equal(actual.address,`123 Main Street ${city}`);
  }
  const separated=importFormData(source({address:`123 Main Street, ${city}, TX 76691, USA`,city,state:'TX',postalCode:'76691'}),null);
  assert.equal(separated.address,'123 Main Street');
 }
});

test('an ambiguous direction that also names the state is not mistaken for postal text',()=>{
 for(const address of ['123 Main Street NE, NE 68102, USA','123 Main Street NE NE 68102 USA']){
  const actual=importFormData(source({address,city:'NE',state:'NE',postalCode:'68102'}),null);
  assert.equal(actual.address,'123 Main Street NE');
 }
});

test('state-named building text survives ambiguous-name handling with or without a postal remainder',()=>{
 for(const address of ['123 Main Street, Building Texas','123 Main Street, Building Texas, TX 76691, USA']){
  const actual=importFormData(source({address,city:'West',state:'TX',postalCode:'76691'}),null);
  assert.equal(actual.address,'123 Main Street, Building Texas');
 }
 const bare=importFormData(source({address:'123 Main Street NE',city:'NE',state:'NE',postalCode:'68501'}),null);
 assert.equal(bare.address,'123 Main Street NE');
});
