(function(global){
  "use strict";
  const NAME="HydroSHEDSFlowAccumulationAdapterV32",VERSION="FORECAST-1J6G11.0";
  const META_URL="/data/hydrology/saudi_hydrosheds_acc_15s.meta.json";
  const DATA_URL="/data/hydrology/saudi_hydrosheds_acc_15s.u32";
  const MAX_WINDOW_BYTES=4*1024*1024;
  let metadataPromise=null;
  const rad=x=>x*Math.PI/180;
  function distanceKm(a,b,c,d){const R=6371,p1=rad(a),p2=rad(c),dp=rad(c-a),dl=rad(d-b);const q=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
  async function metadata(){
    if(!metadataPromise)metadataPromise=fetch(META_URL,{cache:"force-cache"}).then(async r=>{
      if(!r.ok)throw Error("ACC metadata HTTP "+r.status);
      const m=await r.json();
      if(m.dtype!=="uint32"||m.byteOrder!=="little-endian"||m.layout!=="row-major"||m.syntheticData!==false)throw Error("Unsupported or synthetic ACC metadata");
      for(const k of ["width","height","left","top","pixelWidth","pixelHeight"]){if(!Number.isFinite(Number(m[k])))throw Error("Invalid ACC metadata: "+k);}
      if(m.width<=0||m.height<=0||m.pixelWidth<=0||m.pixelHeight<=0)throw Error("Invalid ACC grid geometry");
      return m;
    }).catch(e=>{metadataPromise=null;throw e;});
    return metadataPromise;
  }
  function cell(m,lat,lon){return {row:Math.floor((m.top-lat)/m.pixelHeight),col:Math.floor((lon-m.left)/m.pixelWidth)};}
  async function readRow(m,row,first,last){
    if(row<0||row>=m.height||first<0||last>=m.width||last<first)throw Error("ACC row outside grid");
    const start=4*(row*m.width+first),end=4*(row*m.width+last+1)-1;
    if(end-start+1>MAX_WINDOW_BYTES)throw Error("ACC requested row exceeds safe range");
    const response=await fetch(DATA_URL,{headers:{Range:`bytes=${start}-${end}`},cache:"no-store"});
    if(response.status!==206){await response.body?.cancel();throw Error("ACC Range HTTP "+response.status+" (206 required)");}
    const contentRange=response.headers.get("content-range")||"";
    const match=/^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(contentRange);
    if(!match||Number(match[1])!==start||Number(match[2])!==end||Number(match[3])!==m.width*m.height*4){await response.body?.cancel();throw Error("ACC Content-Range mismatch");}
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==end-start+1)throw Error("ACC incomplete partial read");
    return new DataView(bytes);
  }
  async function evaluateCity(city,options={}){
    const lat=Number(city?.lat??city?.latitude),lon=Number(city?.lon??city?.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)throw Error("Valid city coordinates required");
    const radiusKm=options.radiusKm===undefined?3:Number(options.radiusKm);
    if(!Number.isFinite(radiusKm)||radiusKm<0||radiusKm>10)throw Error("radiusKm must be between 0 and 10");
    const m=await metadata(),c=cell(m,lat,lon);
    if(c.row<0||c.row>=m.height||c.col<0||c.col>=m.width)throw Error("City outside HydroSHEDS ACC grid");
    const dLat=radiusKm/111.32,dLon=radiusKm/(111.32*Math.max(.1,Math.cos(rad(lat))));
    const rr=Math.ceil(dLat/m.pixelHeight),cc=Math.ceil(dLon/m.pixelWidth);
    const r0=Math.max(0,c.row-rr),r1=Math.min(m.height-1,c.row+rr),k0=Math.max(0,c.col-cc),k1=Math.min(m.width-1,c.col+cc);
    let max=-1,best=null,valid=0,center=null,rowsRead=0,bytesRead=0;
    for(let r=r0;r<=r1;r++){
      const view=await readRow(m,r,k0,k1);rowsRead++;bytesRead+=view.byteLength;
      const y=m.top-(r+.5)*m.pixelHeight;
      for(let k=k0;k<=k1;k++){
        const v=view.getUint32((k-k0)*4,true);
        if(r===c.row&&k===c.col)center=v===m.nodata?null:v;
        if(v===m.nodata)continue;
        const x=m.left+(k+.5)*m.pixelWidth,d=distanceKm(lat,lon,y,x);
        if(d>radiusKm)continue;
        valid++;
        if(v>max){max=v;best={latitude:+y.toFixed(6),longitude:+x.toFixed(6),distanceKm:+d.toFixed(3),acc:v,row:r,col:k};}
      }
    }
    const ok=!!best;
    return {engine:NAME,version:VERSION,status:ok?"REAL_DRAINAGE_CONTEXT_READY":"REAL_DRAINAGE_CONTEXT_UNAVAILABLE",city:city?.nameAr||city?.name||city?.nameEn||null,coordinates:{lat,lon},searchRadiusKm:radiusKm,centerAcc:center,maxAcc:ok?best.acc:null,strongestCell:best,validCells:valid,readDiagnostics:{mode:"HTTP_RANGE",rowsRead,bytesRead,fullFileDownloaded:false},source:{provider:"HydroSHEDS",product:"Flow Accumulation (ACC)",resolutionArcSeconds:m.resolutionArcSeconds,sourceFile:m.sourceFile,syntheticData:false},interpretation:{metric:"upstream accumulated grid-cell count",municipalDrainageCapacity:false,confirmedFloodPrediction:false},syntheticData:false};
  }
  const api={name:NAME,version:VERSION,evaluateCity,getStatus:()=>({name:NAME,version:VERSION,realDataRequired:true,syntheticDataAllowed:false,municipalDrainageCapacity:false,readMode:"HTTP_RANGE"})};
  global.HydroSHEDSFlowAccumulationAdapterV32=api;
  global.RG32=global.RG32||{};
  global.RG32.HydroSHEDSFlowAccumulationAdapter=api;
  console.log(`[RainGuard] ${NAME} ${VERSION} loaded`);
})(window);
