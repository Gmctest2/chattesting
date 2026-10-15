(function () {
  "use strict";

  var app = document.getElementById("app");
  var cfg = window.PIGEON_CONFIG || {};
  var sb = null;
  var me = null;            // { id, username, hue }
  var rooms = [];
  var roomId = null;
  var msgs = [];
  var profiles = {};        // id -> { username, hue }
  var channel = null;
  var ui = {};

  var LOGO = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 20c0-6 5-10 11-10 2 0 3 .3 5 1.2L26 8l-1.2 5.2C27 15 29 17.5 29 21c0 4-3 7-8 7-4 0-6-1.5-8-1.5S9 28 6 26c-2-1.400-3-3.600-3-6Z" fill="currentColor"/><circle cx="21" cy="14.5" r="1.400" fill="var(--accent-ink, #fff)"/></svg>';

  /* ---------- Outils ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function html(tag, cls, markup) { var n = el(tag, cls); n.innerHTML = markup; return n; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function hueFor(name) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h; }
  function avatar(name, hue, small) {
    var a = el("div", "avatar" + (small ? " sm" : ""), name.slice(0, 1));
    a.style.background = "hsl(" + hue + " 48% 38%)";
    a.setAttribute("aria-hidden", "true");
    return a;
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) {
      t = el("div"); t.id = "toast"; t.setAttribute("role", "status");
      t.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(24px + env(safe-area-inset-bottom,0px));background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:10px;font-size:14px;z-index:20;max-width:90%";
      document.body.appendChild(t);
    }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }

  function friendlyError(e) {
    var m = String((e && e.message) || "");
    if (/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
    if (/email not confirmed/i.test(m)) return "Confirme d'abord ton adresse e-mail avec le lien reçu, puis reconnecte-toi.";
    if (/already registered|already been registered/i.test(m)) return "Un compte existe déjà avec cet e-mail.";
    if (/database error/i.test(m)) return "Ce nom d'utilisateur est déjà pris. Choisis-en un autre.";
    if (/rate limit/i.test(m)) return "Trop d'essais. Attends quelques minutes puis réessaie.";
    if (/password/i.test(m) && /characters|short|weak/i.test(m)) return "Le mot de passe est trop faible. Prends-en un plus long.";
    if (/failed to fetch|network/i.test(m)) return "Connexion impossible. Vérifie ton réseau.";
    return "Impossible de terminer. Réessaie dans un instant.";
  }

  /* ---------- Démarrage ---------- */
  function showSetup() {
    clear(app);
    var box = el("div", "auth");
    box.style.gridTemplateColumns = "minmax(0,1fr)";
    var s = el("div", "auth-side");
    var c = el("div", "auth-card");
    c.appendChild(el("h1", null, "Il manque la connexion à Supabase"));
    c.appendChild(el("p", "sub", "Ouvre le fichier config.js, colle l'adresse du projet et la clé anon public de Supabase, puis redéploie le site. Le guide README.md explique chaque étape."));
    s.appendChild(c); box.appendChild(s); app.appendChild(box);
  }

  async function start() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) { showSetup(); return; }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_OUT") showAuth("login"); });
    try {
      var r = await sb.auth.getSession();
      if (r.data && r.data.session) await enterChat(r.data.session.user);
      else showAuth("login");
    } catch (e) { showAuth("login"); }
  }

  /* ---------- Connexion ---------- */
  function showAuth(startMode, note) {
    if (channel) { sb.removeChannel(channel); channel = null; }
    me = null; rooms = []; roomId = null; msgs = [];
    clear(app);
    var mode = startMode || "login";

    var wrap = el("div", "auth");
    var brand = el("section", "brand");
    var top = el("div");
    var wm = html("div", "wordmark", LOGO); wm.appendChild(el("span", null, "Pigeon"));
    top.appendChild(wm);
    brand.appendChild(top);
    var mid = el("div");
    mid.appendChild(el("h2", null, "Des salons où tout le monde répond."));
    mid.appendChild(el("p", "lede", "Crée un compte, rejoins un salon et écris. Les messages arrivent en direct chez tous ceux qui ont la page ouverte."));
    brand.appendChild(mid);
    var bubbles = el("div", "bubbles");
    bubbles.setAttribute("aria-hidden", "true");
    bubbles.appendChild(el("div", "bubble-demo", "Salut, tu es là ?"));
    bubbles.appendChild(el("div", "bubble-demo r", "Oui, j'arrive dans le salon."));
    brand.appendChild(bubbles);

    var side = el("section", "auth-side");
    var card = el("form", "auth-card");
    card.setAttribute("novalidate", "");
    var tabs = el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    var tLogin = el("button", "tab", "Connexion");
    var tReg = el("button", "tab", "Créer un compte");
    [tLogin, tReg].forEach(function (t) { t.type = "button"; t.setAttribute("role", "tab"); });
    tabs.appendChild(tLogin); tabs.appendChild(tReg);

    var head = el("div");
    var h1 = el("h1"); var sub = el("p", "sub");
    head.appendChild(h1); head.appendChild(sub);

    var fU = el("div", "field");
    var lU = el("label", null, "Nom d'utilisateur"); lU.htmlFor = "f-user";
    var iU = el("input"); iU.id = "f-user"; iU.autocomplete = "username"; iU.autocapitalize = "none"; iU.spellcheck = false; iU.maxLength = 20;
    fU.appendChild(lU); fU.appendChild(iU);
    fU.appendChild(el("p", "hint", "3 à 20 caractères : lettres, chiffres, tiret ou tiret bas. Les autres le verront."));

    var fE = el("div", "field");
    var lE = el("label", null, "Adresse e-mail"); lE.htmlFor = "f-email";
    var iE = el("input"); iE.id = "f-email"; iE.type = "email"; iE.autocomplete = "email"; iE.maxLength = 120;
    fE.appendChild(lE); fE.appendChild(iE);

    var fP = el("div", "field");
    var lP = el("label", null, "Mot de passe"); lP.htmlFor = "f-pass";
    var iP = el("input"); iP.id = "f-pass"; iP.type = "password"; iP.maxLength = 100;
    var hP = el("p", "hint", "6 caractères minimum.");
    fP.appendChild(lP); fP.appendChild(iP); fP.appendChild(hP);

    var info = el("p", "notice"); info.hidden = true;
    var err = el("p", "msg-err"); err.setAttribute("role", "alert");
    var go = el("button", "btn"); go.type = "submit";

    card.appendChild(tabs); card.appendChild(head); card.appendChild(fU); card.appendChild(fE); card.appendChild(fP);
    card.appendChild(info); card.appendChild(err); card.appendChild(go);
    side.appendChild(card);
    wrap.appendChild(brand); wrap.appendChild(side);
    app.appendChild(wrap);

    function setNote(text) { info.hidden = !text; info.textContent = text || ""; }
    function setMode(m) {
      mode = m;
      var reg = m === "register";
      tLogin.setAttribute("aria-selected", String(!reg));
      tReg.setAttribute("aria-selected", String(reg));
      h1.textContent = reg ? "Crée ton compte" : "Content de te revoir";
      sub.textContent = reg ? "Choisis un nom que les autres verront dans les salons." : "Connecte-toi pour retrouver tes salons.";
      fU.hidden = !reg; hP.hidden = !reg;
      iP.autocomplete = reg ? "new-password" : "current-password";
      go.textContent = reg ? "Créer mon compte" : "Se connecter";
      err.textContent = "";
    }
    tLogin.addEventListener("click", function () { setMode("login"); setNote(null); });
    tReg.addEventListener("click", function () { setMode("register"); setNote(null); });
    setMode(mode);
    setNote(note);

    var busy = false;
    card.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      if (busy) return;
      err.textContent = "";
      var name = iU.value.trim().toLowerCase();
      var email = iE.value.trim();
      var pw = iP.value;
      if (mode === "register" && !/^[a-z0-9_-]{3,20}$/.test(name)) { err.textContent = "Le nom doit faire 3 à 20 caractères : lettres, chiffres, - ou _."; return; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Entre une adresse e-mail valide."; return; }
      if (pw.length < 6) { err.textContent = "Le mot de passe doit faire au moins 6 caractères."; return; }
      busy = true; go.disabled = true;
      try {
        if (mode === "register") {
          var up = await sb.auth.signUp({ email: email, password: pw, options: { data: { username: name } } });
          if (up.error) throw up.error;
          if (!up.data.session) {
            setMode("login");
            setNote("Compte créé. Ouvre le lien reçu par e-mail pour le confirmer, puis connecte-toi.");
          } else {
            await enterChat(up.data.user);
          }
        } else {
          var inn = await sb.auth.signInWithPassword({ email: email, password: pw });
          if (inn.error) throw inn.error;
          await enterChat(inn.data.user);
        }
      } catch (e) {
        err.textContent = friendlyError(e);
      }
      busy = false; go.disabled = false;
    });
    (mode === "register" ? iU : iE).focus();
  }

  /* ---------- Messagerie ---------- */
  async function enterChat(user) {
    var p = await sb.from("profiles").select("id,username,hue").eq("id", user.id).maybeSingle();
    if (p.error || !p.data) {
      await sb.auth.signOut();
      showAuth("login", "Ton profil est introuvable. Vérifie que schema.sql a bien été exécuté dans Supabase.");
      return;
    }
    me = p.data;
    profiles[me.id] = { username: me.username, hue: me.hue };

    clear(app);
    var chat = el("div", "chat");
    ui.chat = chat;

    var side = el("aside", "side");
    var sh = el("div", "side-head");
    var wm = html("div", "wordmark", LOGO); wm.appendChild(el("span", null, "Pigeon"));
    sh.appendChild(wm);
    side.appendChild(sh);
    side.appendChild(el("div", "label", "Salons"));
    ui.rooms = el("ul", "rooms");
    side.appendChild(ui.rooms);

    var add = el("form", "add-room");
    var ai = el("input"); ai.id = "new-room"; ai.placeholder = "Nouveau salon"; ai.maxLength = 24; ai.setAttribute("aria-label", "Nom du nouveau salon");
    var ab = el("button", null, "+"); ab.type = "submit"; ab.setAttribute("aria-label", "Créer le salon");
    add.appendChild(ai); add.appendChild(ab);
    add.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var n = ai.value.trim();
      if (n.length < 2) return;
      ai.value = "";
      var r = await sb.from("rooms").insert({ name: n, created_by: me.id }).select("id,name").single();
      if (r.error) { toast("Le salon n'a pas pu être créé."); return; }
      addRoom(r.data);
      selectRoom(r.data.id);
    });
    side.appendChild(add);

    var meBox = el("div", "me");
    meBox.appendChild(avatar(me.username, me.hue, false));
    meBox.appendChild(el("div", "who", me.username));
    var out = el("button", "btn ghost", "Quitter"); out.type = "button";
    out.addEventListener("click", function () { sb.auth.signOut(); });
    meBox.appendChild(out);
    side.appendChild(meBox);

    var main = el("section", "main");
    var mh = el("div", "main-head");
    var mb = el("button", "menu-btn"); mb.type = "button"; mb.setAttribute("aria-label", "Ouvrir la liste des salons");
    mb.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 5h12M3 9h12M3 13h12"/></svg>';
    mb.addEventListener("click", function () { chat.classList.add("open"); });
    ui.title = el("h2");
    mh.appendChild(mb); mh.appendChild(ui.title);
    ui.feed = el("div", "feed");
    ui.feed.setAttribute("aria-live", "polite");

    var comp = el("form", "composer");
    ui.input = el("textarea"); ui.input.id = "msg-input"; ui.input.rows = 1; ui.input.maxLength = 1000;
    ui.input.placeholder = "Écris un message"; ui.input.setAttribute("aria-label", "Ton message");
    ui.send = el("button", "btn", "Envoyer"); ui.send.type = "submit";
    comp.appendChild(ui.input); comp.appendChild(ui.send);
    ui.input.addEventListener("input", grow);
    ui.input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); comp.requestSubmit(); }
    });
    comp.addEventListener("submit", function (ev) { ev.preventDefault(); sendMessage(); });

    main.appendChild(mh); main.appendChild(ui.feed); main.appendChild(comp);
    var scrim = el("button", "scrim"); scrim.type = "button"; scrim.setAttribute("aria-label", "Fermer la liste des salons");
    scrim.addEventListener("click", function () { chat.classList.remove("open"); });
    chat.appendChild(side); chat.appendChild(main); chat.appendChild(scrim);
    app.appendChild(chat);

    renderRooms();
    renderTitle();
    renderFeed();

    channel = sb.channel("pigeon")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rooms" }, function (payload) { addRoom(payload.new); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, function (payload) { onNewMessage(payload.new); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, function (payload) { removeMessage(payload.old && payload.old.id); })
      .subscribe();

    var r = await sb.from("rooms").select("id,name").order("created_at", { ascending: true });
    if (r.error) { toast("La liste des salons n'a pas pu être chargée."); return; }
    rooms = r.data || [];
    var last = load("pigeon.room");
    var pick = rooms.some(function (x) { return x.id === last; }) ? last : (rooms[0] && rooms[0].id);
    renderRooms();
    if (pick) selectRoom(pick); else { renderTitle(); renderFeed(); }
  }

  function grow() { ui.input.style.height = "auto"; ui.input.style.height = Math.min(ui.input.scrollHeight, 140) + "px"; }

  function addRoom(r) {
    if (!r || !ui.rooms || rooms.some(function (x) { return x.id === r.id; })) return;
    rooms.push({ id: r.id, name: r.name });
    renderRooms();
    if (!roomId) selectRoom(r.id);
  }

  function renderRooms() {
    clear(ui.rooms);
    if (!rooms.length) { var li0 = el("li", "hint", "Aucun salon pour le moment."); li0.style.padding = "8px 10px"; ui.rooms.appendChild(li0); return; }
    rooms.forEach(function (r) {
      var li = el("li");
      var b = el("button", "room-btn"); b.type = "button";
      b.appendChild(el("i", null, "#")); b.appendChild(el("span", null, r.name));
      if (r.id === roomId) b.setAttribute("aria-current", "true");
      b.addEventListener("click", function () { selectRoom(r.id); ui.chat.classList.remove("open"); });
      li.appendChild(b); ui.rooms.appendChild(li);
    });
  }
  function renderTitle() {
    clear(ui.title);
    var r = rooms.filter(function (x) { return x.id === roomId; })[0];
    if (r) { ui.title.appendChild(el("i", null, "#")); ui.title.appendChild(document.createTextNode(r.name)); }
    else ui.title.textContent = "Pigeon";
  }

  async function ensureProfiles(ids) {
    var missing = ids.filter(function (id, i) { return id && !profiles[id] && ids.indexOf(id) === i; });
    if (!missing.length) return;
    var r = await sb.from("profiles").select("id,username,hue").in("id", missing);
    (r.data || []).forEach(function (p) { profiles[p.id] = { username: p.username, hue: p.hue }; });
  }

  async function selectRoom(id) {
    if (id === roomId && msgs.length) return;
    roomId = id;
    store("pigeon.room", id);
    msgs = [];
    ui.feed.dataset.seen = "";
    renderRooms(); renderTitle(); renderFeed();
    var mine = id;
    var r = await sb.from("messages").select("id,room_id,user_id,body,created_at")
      .eq("room_id", id).order("created_at", { ascending: false }).limit(100);
    if (mine !== roomId) return;
    if (r.error) { toast("Les messages n'ont pas pu être chargés."); return; }
    var list = (r.data || []).slice().reverse();
    await ensureProfiles(list.map(function (m) { return m.user_id; }));
    if (mine !== roomId) return;
    var seen = {};
    list.forEach(function (m) { seen[m.id] = true; });
    msgs = list.concat(msgs.filter(function (m) { return !seen[m.id]; }));
    renderFeed();
  }

  async function onNewMessage(m) {
    if (!m || m.room_id !== roomId) return;
    if (msgs.some(function (x) { return x.id === m.id; })) return;
    await ensureProfiles([m.user_id]);
    if (m.room_id !== roomId || msgs.some(function (x) { return x.id === m.id; })) return;
    msgs.push(m);
    renderFeed();
  }
  function removeMessage(id) {
    if (id == null) return;
    var n = msgs.length;
    msgs = msgs.filter(function (m) { return m.id !== id; });
    if (msgs.length !== n) renderFeed();
  }

  var dayFmt = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" });
  var timeFmt = new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" });
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
  function dayLabel(ts) {
    var now = Date.now();
    if (dayKey(ts) === dayKey(now)) return "Aujourd'hui";
    if (dayKey(ts) === dayKey(now - 86400000)) return "Hier";
    return dayFmt.format(new Date(ts));
  }

  function renderFeed() {
    var feed = ui.feed;
    var nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    clear(feed);
    if (!roomId) {
      var e0 = el("div", "empty");
      e0.appendChild(el("h3", null, "Aucun salon"));
      e0.appendChild(el("p", null, "Crée le premier salon avec le champ en bas à gauche, puis écris dedans."));
      feed.appendChild(e0); return;
    }
    if (!msgs.length) {
      var e1 = el("div", "empty");
      e1.appendChild(el("h3", null, "Salon vide"));
      e1.appendChild(el("p", null, "Aucun message ici. Écris le premier."));
      feed.appendChild(e1); return;
    }
    var prev = null;
    msgs.forEach(function (m) {
      var ts = Date.parse(m.created_at) || Date.now();
      var prof = profiles[m.user_id] || { username: "?", hue: 0 };
      var mineMsg = m.user_id === me.id;
      if (!prev || dayKey(prev.ts) !== dayKey(ts)) feed.appendChild(el("div", "day", dayLabel(ts)));
      var cont = prev && prev.user === m.user_id && dayKey(prev.ts) === dayKey(ts) && ts - prev.ts < 5 * 60000;
      var row = el("div", "row" + (mineMsg ? " mine" : "") + (cont ? " cont" : ""));
      if (cont) row.appendChild(el("div", "spacer"));
      else row.appendChild(avatar(prof.username, prof.hue, true));
      var col = el("div", "col");
      if (!cont) {
        var meta = el("div", "meta");
        meta.appendChild(el("b", null, prof.username));
        meta.appendChild(el("time", null, timeFmt.format(new Date(ts))));
        col.appendChild(meta);
      }
      col.appendChild(el("div", "bubble", String(m.body || "")));
      row.appendChild(col);
      if (mineMsg) {
        var del = el("button", "del", "Supprimer"); del.type = "button";
        del.addEventListener("click", async function () {
          var r = await sb.from("messages").delete().eq("id", m.id);
          if (r.error) toast("Le message n'a pas pu être supprimé.");
          else removeMessage(m.id);
        });
        row.appendChild(del);
      }
      feed.appendChild(row);
      prev = { user: m.user_id, ts: ts };
    });
    if (nearBottom || !feed.dataset.seen) { feed.scrollTop = feed.scrollHeight; feed.dataset.seen = "1"; }
  }

  async function sendMessage() {
    var text = ui.input.value.trim();
    if (!text || !roomId) return;
    ui.input.value = ""; grow();
    ui.feed.dataset.seen = "";
    var r = await sb.from("messages").insert({ room_id: roomId, body: text.slice(0, 1000) })
      .select("id,room_id,user_id,body,created_at").single();
    if (r.error) {
      ui.input.value = text; grow();
      toast("Le message n'a pas été envoyé.");
      return;
    }
    if (r.data.room_id === roomId && !msgs.some(function (x) { return x.id === r.data.id; })) {
      msgs.push(r.data);
      renderFeed();
    }
    ui.input.focus();
  }

  start();
})();
