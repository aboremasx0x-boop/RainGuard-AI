/*
RainGuard AI V32
Phase 38M-18F
Motion Vector Renderer
Version 32.38M.18F
*/

(function(global){
"use strict";

const VERSION="32.38M.18F";

class MotionVectorRenderer{

 render(track){
   return {
      trackId:track?.trackId??null,
      polyline:(track?.vectors||[]).map(v=>({
         lat:v?.endCoordinate?.latitude,
         lon:v?.endCoordinate?.longitude
      })),
      arrows:(track?.vectors||[]).map(v=>({
         bearing:v?.bearing??null,
         speed:v?.speedKmh??null
      }))
   };
 }

 renderAll(){
   const stats=global.RainArrivalMotionVectorStatisticsV32;
   const repo=global.RainArrivalMotionVectorRepositoryV32;
   const tracks=repo?.getAllTracks?.()||[];
   const layers=tracks.map(t=>this.render(t));
   global.RainArrivalMotionVectorRenderLayers=layers;
   global.RainGuardAI=global.RainGuardAI||{};
   global.RainGuardAI.V32=global.RainGuardAI.V32||{};
   global.RainGuardAI.V32.motionVectorRenderLayers=layers;
   return {
      success:true,
      version:VERSION,
      layerCount:layers.length,
      statistics:stats?.getNationalStatistics?.()||null,
      layers
   };
 }

 printTable(){
   console.table((global.RainArrivalMotionVectorRenderLayers||[]).map(x=>({
      trackId:x.trackId,
      points:x.polyline.length,
      arrows:x.arrows.length
   })));
 }

 getDiagnostics(){
   return {
      version:VERSION,
      layers:(global.RainArrivalMotionVectorRenderLayers||[]).length
   };
 }
}

const engine=new MotionVectorRenderer();
global.RainArrivalMotionVectorRendererV32=engine;
console.log("[RainGuard] Motion Vector Renderer loaded",VERSION);

})(typeof globalThis!=="undefined"?globalThis:window);
