window.RG = window.RG || {};

RG.KnowledgeGraph = {
  nodes:[
    ["Radar",.12,.20],["Rain",.32,.12],["Flood",.55,.25],["Roads",.76,.42],
    ["Hospitals",.70,.70],["Population",.42,.82],["Emergency",.18,.66],["Decision",.12,.42]
  ],
  edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]],
  draw(canvas,activeLabel){
    if(!canvas)return;
    const ctx=canvas.getContext("2d"),w=canvas.clientWidth,h=canvas.clientHeight;
    canvas.width=w;canvas.height=h;ctx.clearRect(0,0,w,h);
    ctx.lineWidth=2;
    this.edges.forEach(([a,b])=>{
      const A=this.nodes[a],B=this.nodes[b];
      ctx.beginPath();ctx.strokeStyle="rgba(46,168,255,.65)";
      ctx.moveTo(A[1]*w,A[2]*h);ctx.lineTo(B[1]*w,B[2]*h);ctx.stroke();
    });
    this.nodes.forEach(n=>{
      const active=n[0]===activeLabel,x=n[1]*w,y=n[2]*h;
      ctx.beginPath();ctx.fillStyle=active?"#ffd54d":"#2ea8ff";ctx.arc(x,y,active?25:20,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=active?"#ffd54d":"#2ea8ff";ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle="#fff";ctx.font="13px Segoe UI";ctx.textAlign="center";ctx.fillText(n[0],x,y+42);
    });
  }
};
