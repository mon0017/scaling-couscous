import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import type {DeductionRow} from './payroll';
export const payrollHeaders=['Loan ID','Member Email','Amount PHP','Payment Date','Reference'];
const nodes=(root:Document|Element,name:string)=>Array.from(root.getElementsByTagNameNS('*',name));
function xml(text:string){const doc=new DOMParser().parseFromString(text,'application/xml');if(nodes(doc,'parsererror').length||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Invalid workbook XML. Save a new .xlsx file using the template.');return doc}
export async function readPayrollWorkbook(file:File):Promise<DeductionRow[]>{
 if(!/\.xlsx$/i.test(file.name)||file.size>2*1024*1024||file.size===0)throw Error('Choose a .xlsx workbook up to 2 MB. Old .xls and macro files are not supported.');
 let expanded=0;const data=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{expanded+=entry.originalSize;if(expanded>8*1024*1024)throw Error('Workbook is too large when expanded. Use the small payroll template.');return /^(xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/[^/]+.xml))$/.test(entry.name)}});
 const get=(path:string)=>{if(!data[path])throw Error('Workbook is missing required data. Use the downloaded template.');return xml(strFromU8(data[path]))};
 const workbook=get('xl/workbook.xml');if(nodes(workbook,'workbookPr').some(n=>['1','true'].includes(n.getAttribute('date1904')||'')))throw Error('1904-date workbooks are unsupported. Use YYYY-MM-DD text dates in the template.');
 const sheets=nodes(workbook,'sheet');if(sheets.length!==1)throw Error('Use one worksheet only, with the five template columns.');
 const relationId=sheets[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
 const relation=nodes(get('xl/_rels/workbook.xml.rels'),'Relationship').find(n=>n.getAttribute('Id')===relationId);
 let target=relation?.getAttribute('Target')||'';if(target.startsWith('/'))target=target.slice(1);else target='xl/'+target;
 if(!/^xl\/worksheets\/[\w.-]+\.xml$/.test(target))throw Error('Unsupported worksheet location. Use the template.');
 const strings=data['xl/sharedStrings.xml']?nodes(get('xl/sharedStrings.xml'),'si').map(si=>nodes(si,'t').map(t=>t.textContent||'').join('')):[];
 const sheet=get(target),rows=nodes(sheet,'row').filter(r=>nodes(r,'c').some(c=>nodes(c,'v').length||nodes(c,'t').length));
 if(rows.length<2||rows.length>101)throw Error('Include a header and 1–100 deduction rows.');
 const values=rows.map(row=>{const result=Array<string>(5).fill('');for(const c of nodes(row,'c')){if(nodes(c,'f').length)throw Error('Formulas are not accepted. Paste values before uploading.');const ref=c.getAttribute('r')||'';const match=/^([A-E])\d+$/.exec(ref);if(!match){if(nodes(c,'v').length||nodes(c,'t').length)throw Error('Only columns A–E are supported. Use the template.');continue}const col=match[1].charCodeAt(0)-65,type=c.getAttribute('t');let v=type==='inlineStr'?nodes(c,'t').map(t=>t.textContent||'').join(''):nodes(c,'v')[0]?.textContent||'';if(type==='s')v=strings[Number(v)]??'';if(col===3&&type!=='s'&&type!=='inlineStr'&&/^\d+(\.0+)?$/.test(v)){const serial=Number(v);if(serial>=61&&serial<=2958465)v=new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10)}if(v.length>254)throw Error('A cell is too long. Keep only the template data.');result[col]=v.trim()}return result});
 if(values[0].some((v,i)=>v.toLowerCase()!==payrollHeaders[i].toLowerCase()))throw Error('Headers must be: '+payrollHeaders.join(', ')+'.');
 return values.slice(1).map((r,i)=>({row:i+2,loanId:r[0],email:r[1],amount:r[2],date:r[3],reference:r[4]}));
}
export function payrollWorkbook(rows:DeductionRow[]){
 const esc=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const cells=[payrollHeaders,...rows.map(r=>[r.loanId,r.email,r.amount,r.date,r.reference])].map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`).join('');
 const files:Record<string,string>={
  '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Deductions" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="2" width="36" customWidth="1"/><col min="3" max="4" width="20" customWidth="1"/><col min="5" max="5" width="42" customWidth="1"/></cols><sheetData>${cells}</sheetData><autoFilter ref="A1:E${rows.length+1}"/></worksheet>`
 };
 const bytes=zipSync(Object.fromEntries(Object.entries(files).map(([name,value])=>[name,strToU8(value)])));return new Blob([new Uint8Array(bytes).buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function downloadWorkbook(rows:DeductionRow[],name:string){const url=URL.createObjectURL(payrollWorkbook(rows)),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
