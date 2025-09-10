(function(){
  const $ = (id) => document.getElementById(id);
  const yearEl = $('year'); yearEl.textContent = new Date().getFullYear();

  const STORAGE_KEY = 'mvws_conveyor_inputs_vanilla_v2';
  const defaults = {
    B3_length_m: 172,
    C3_width_m: 0.8,
    D3_belts: 2,
    C4_nozzleSpacing_m: 3,
    C5_nozzlesPerLocation: 2,
    C6_lhsSides: 3,
    C7_lhsToPanel_m: 15,
    C10_pressure_bar: 2.1,
  };

  const toNum = (v, fb=0)=> {
    if (v===null || v===undefined || v==='') return fb;
    const n = Number(v); return Number.isFinite(n) ? n : fb;
  };
  const evenUp = (x)=> {
    if (!Number.isFinite(x) || x < 0) return 0;
    const i = Math.ceil(x); return i % 2 === 0 ? i : i + 1;
  };
  const round = (x, d=2)=> {
    if (!Number.isFinite(x)) return 0;
    const p = Math.pow(10, d); return Math.round((x + Number.EPSILON) * p) / p;
  };
  const kBucket = (k)=> {
    const T = [18,22,26,30,34,41,51,64,79];
    for (const t of T) if (k <= t) return t;
    return 91;
  };

  function loadInputs() {
    let state = {...defaults};
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) state = { ...state, ...saved };
      const url = new URL(window.location.href);
      for (const k of Object.keys(defaults)) {
        if (url.searchParams.has(k)) state[k] = toNum(url.searchParams.get(k), state[k]);
      }
    } catch(e){}
    for (const k of Object.keys(defaults)) {
      if ($(k)) $(k).value = state[k];
    }
  }

  function readState() {
    const s = {};
    for (const k of Object.keys(defaults)) if ($(k)) s[k] = toNum($(k).value, defaults[k]);
    return s;
  }

  function compute() {
    const inp = readState();
    const L = toNum(inp.B3_length_m);
    const W = toNum(inp.C3_width_m);
    const Nbelts = Math.max(1, Math.floor(toNum(inp.D3_belts)));
    const S = Math.max(0.0001, toNum(inp.C4_nozzleSpacing_m));
    const nPerLoc = Math.max(1, Math.floor(toNum(inp.C5_nozzlesPerLocation)));
    const lhsSides = Math.max(0, Math.floor(toNum(inp.C6_lhsSides)));
    const lhsToPanel = Math.max(0, toNum(inp.C7_lhsToPanel_m));
    const Pbar = Math.max(0.0001, toNum(inp.C10_pressure_bar));

    const density = 10.2; // lpm/m²
    const area_m2 = L * W * Nbelts;
    const flow_Lpm = area_m2 * density;
    const flow_m3h = flow_Lpm * 0.06;

    const runs = Math.ceil(L / S);
    const nozzleQty = evenUp(runs * nPerLoc * 1.05);

    const lhsBase = Math.ceil(L * lhsSides) + lhsToPanel;
    const lhsEven = evenUp(lhsBase);
    const lhsWith10 = lhsEven * 1.1;

    const flowPerNozzle_Lpm = nozzleQty > 0 ? flow_Lpm / nozzleQty : 0;
    const kCalc = flowPerNozzle_Lpm / Math.sqrt(Pbar);
    const kSelected = kBucket(kCalc);

    // Actual flows from selected K (per Excel rows 16-17)
    const actual_Lpm = kSelected * Math.sqrt(Pbar) * nozzleQty;
    const actual_m3h = actual_Lpm * 0.06;

    // Deluge Valve selection (per Excel row 18)
    let delugeValve = "Not Found";
    if (actual_m3h >= 10 && actual_m3h <= 501) {
      if (actual_m3h >= 201) delugeValve = 150;
      else if (actual_m3h >= 101) delugeValve = 100;
      else if (actual_m3h >= 51) delugeValve = 80;
      else if (actual_m3h >= 10) delugeValve = 50;
    }

    return {
      inp, area_m2, flow_Lpm, flow_m3h, nozzleQty, lhsBase, lhsEven, lhsWith10,
      flowPerNozzle_Lpm, kCalc, kSelected, actual_Lpm, actual_m3h, delugeValve
    };
  }

  function render() {
    const r = compute();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r.inp));
    const kv = [
      ['Total Area', `${round(r.area_m2,2)} m²`],
      ['Theoretical Flow', `${round(r.flow_Lpm,2)} L/min (${round(r.flow_m3h,2)} m³/h)`],
      ['Nozzle Qty (incl. 5%)', `${r.nozzleQty} nos`],
      ['LHS Cable Base', `${r.lhsBase} m (even→ ${r.lhsEven} m)`],
      ['LHS Cable with 10%', `${round(r.lhsWith10,0)} m`],
      ['Flow per Nozzle', `${round(r.flowPerNozzle_Lpm,2)} L/min`],
      ['K-Factor (calc)', `${round(r.kCalc,2)}`],
      ['MVWS Nozzle Selected (K)', `K = ${r.kSelected}`],
      ['Actual Flow (based on K)', `${round(r.actual_Lpm,2)} L/min (${round(r.actual_m3h,2)} m³/h)`],
    ];
    const ul = $('results'); ul.innerHTML='';
    for (const [k,v] of kv) {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = k; a.style.color='#475569';
      const b = document.createElement('b'); b.textContent = v;
      li.appendChild(a); li.appendChild(b);
      ul.appendChild(li);
    }

    const dvs = $('dvs');
    dvs.innerHTML='';
    const label = document.createElement('span');
    label.textContent = 'Selected Size:';
    const badge = document.createElement('span');
    badge.className = 'badge ' + (r.delugeValve==='Not Found' ? 'warn' : 'ok');
    badge.textContent = r.delugeValve==='Not Found' ? 'Not Found' : `${r.delugeValve} mm`;
    dvs.appendChild(label); dvs.appendChild(badge);
  }

  function bind() {
    for (const k of Object.keys(defaults)) {
      if ($(k)) { $(k).addEventListener('input', render); $(k).addEventListener('change', render); }
    }
    $('resetBtn').addEventListener('click', ()=> {
      for (const k of Object.keys(defaults)) if ($(k)) $(k).value = defaults[k];
      render();
    });
    $('exportBtn').addEventListener('click', ()=> {
      const r = compute();
      const payload = { inputs: r.inp, results: r };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mvws-conveyor-calc.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
    $('shareUrlBtn').addEventListener('click', ()=> {
      const s = readState();
      const u = new URL(window.location.href);
      for (const [k,v] of Object.entries(s)) u.searchParams.set(k, v);
      navigator.clipboard.writeText(u.toString()).then(()=>{
        alert('URL with current inputs copied to clipboard.');
      }, ()=>{
        prompt('Copy this URL:', u.toString());
      });
    });
    $('pdfBtn').addEventListener('click', ()=> window.print());
  }

  loadInputs();
  bind();
  render();
})();
