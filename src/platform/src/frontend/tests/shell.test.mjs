import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import React from "react";
import Renderer, { act } from "react-test-renderer";
let mod, temp;
before(async () => {
  temp = await mkdtemp(path.resolve("node_modules/.shell-test-"));
  const outfile = path.join(temp, "shell.mjs");
  await build({
    stdin: {
      contents: `export {RecordsPage} from './src/shell/RecordsPage'; export {CourseSetupPage} from './src/shell/CourseSetupPage'; export {App} from './src/shell/App'; export {LoginPage} from './src/shell/LoginPage'; export {ActivityHost} from './src/host/ActivityHost'; export {saveAuth} from './src/orchestrator/auth'; export {TopBar} from './src/shell/TopBar'; export {DeveloperPage} from './src/shell/DeveloperPage'; export {CourseListPage} from './src/shell/CourseListPage'; export {roleRoute} from './src/orchestrator/routes'; export {validateUpload, uploadCourseFile} from './src/orchestrator/upload'; export {setLocale} from './src/i18n'; export {getBackend,resetBackend,setUnauthorizedHandler} from './src/orchestrator/api';`,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    external: ["react", "react/jsx-runtime"],
  });
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  mod = await import(pathToFileURL(outfile));
  mod.setLocale("en");
});
after(async () => {
  await rm(temp, { recursive: true, force: true });
});
const course = {
  courseVersionId: "c1",
  title: "Vocabulary",
  engine: "znawca",
  languageCode: "en",
  itemCount: 5,
  status: "draft",
  publishedAt: null,
  isEnrolled: false,
};
const button = (view, text) =>
  view.root.findAllByType("button").find((b) => b.children.join("") === text);
test("role routes constrain refresh and navigation", () => {
  assert.equal(mod.roleRoute({ isDeveloper: true }, "#/courses"), "developer");
  assert.equal(mod.roleRoute({ isDeveloper: false }, "#/developer"), "courses");
  assert.equal(
    mod.roleRoute({ isDeveloper: false }, "#/my-courses"),
    "my-courses",
  );
});
test("developer navigation never exposes student catalogs; five languages available", async () => {
  let view;
  await act(async () => {
    view = Renderer.create(
      React.createElement(mod.TopBar, {
        user: { username: "owner", isDeveloper: true },
        onNavigate: () => {},
        onLogout: () => {},
      }),
    );
  });
  assert.equal(button(view, "Select courses"), undefined);
  assert.equal(button(view, "My courses"), undefined);
  assert.equal(
    view.root.findByType("select").findAllByType("option").length,
    5,
  );
  view.unmount();
});
test("catalog joins; owned library exposes single course entry", async () => {
  let view;
  let joined;
  await act(async () => {
    view = Renderer.create(
      React.createElement(mod.CourseListPage, {
        courses: [course],
        view: "courses",
        onEnroll: (id) => (joined = id),
        onEnter: () => {},
      }),
    );
  });
  act(() => button(view, "Add to my courses").props.onClick());
  assert.equal(joined, "c1");
  assert.equal(button(view, "Learn"), undefined);
  await act(async () =>
    view.update(
      React.createElement(mod.CourseListPage, {
        courses: [{ ...course, isEnrolled: true }],
        view: "my-courses",
        onEnroll: () => {},
        onEnter: () => {},
      }),
    ),
  );
  assert.ok(button(view, "Enter course"));
  assert.equal(button(view, "Learn"), undefined);
  assert.equal(button(view, "Add to my courses"), undefined);
  view.unmount();
});
test("upload validates ZIP and 512 MiB before sending", () => {
  assert.equal(
    mod.validateUpload({ name: "course.zip", size: 512 * 1024 * 1024 }),
    null,
  );
  assert.equal(
    mod.validateUpload({ name: "course.zip", size: 512 * 1024 * 1024 + 1 }),
    "upload.tooLarge",
  );
  assert.equal(
    mod.validateUpload({ name: "course.txt", size: 4 }),
    "upload.zipOnly",
  );
});
test("XHR reports transfer and processing, preserves non-JSON 413 for localized handling", async () => {
  let xhr;
  globalThis.XMLHttpRequest = class {
    upload = {};
    constructor() {
      xhr = this;
    }
    open() {}
    setRequestHeader() {}
    send() {}
  };
  const phases = [];
  const promise = mod.uploadCourseFile(new File(["zip"], "course.zip"), (p) =>
    phases.push(p),
  );
  xhr.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 });
  xhr.upload.onload();
  xhr.status = 413;
  xhr.responseText = "<html>Request Entity Too Large</html>";
  xhr.onload();
  await assert.rejects(promise, (e) => e.status === 413);
  assert.deepEqual(phases, [
    { phase: "uploading", percent: 0 },
    { phase: "uploading", percent: 50 },
    { phase: "processing", percent: 100 },
  ]);
});

test("developer upload failure retains selected file for retry and success refreshes drafts", async () => {
  mod.resetBackend();
  const backend = await mod.getBackend();
  let calls = [];
  let refreshed = 0;
  let reject;
  backend.uploadCourse = (file, progress) => {
    calls.push(file);
    progress({ phase: "processing", percent: 100 });
    if (calls.length === 1)
      return new Promise((_resolve, r) => {
        reject = r;
      });
    return Promise.resolve({
      imported: [{ courseVersionId: "new", title: "New course" }],
      warnings: [],
    });
  };
  let view;
  await act(async () => {
    view = Renderer.create(
      React.createElement(mod.DeveloperPage, {
        isDeveloper: true,
        courses: [course],
        onUploaded: () => {
          refreshed++;
        },
        onPreview: () => {},
        onPublish: () => {},
      }),
    );
  });
  const file = new File(["zip"], "same.zip");
  const target = { files: [file], value: "same.zip" };
  act(() => view.root.findByType("input").props.onChange({ target }));
  assert.equal(target.value, "");
  const upload = button(view, "Upload");
  act(() => {
    upload.props.onClick();
    upload.props.onClick();
  });
  assert.equal(calls.length, 0);
  await act(async () => {});
  assert.equal(calls.length, 1);
  assert.ok(JSON.stringify(view.toJSON()).includes("Processing the course"));
  await act(async () => reject(Error("offline")));
  assert.ok(JSON.stringify(view.toJSON()).includes("Connection interrupted"));
  await act(async () => button(view, "Upload").props.onClick());
  assert.deepEqual(calls, [file, file]);
  assert.equal(refreshed, 1);
  assert.ok(JSON.stringify(view.toJSON()).includes("New course"));
  view.unmount();
});
test("developer has unified course entry and publish; published row has unpublish", async () => {
  let actions = [];
  let view;
  await act(async () => {
    view = Renderer.create(
      React.createElement(mod.DeveloperPage, {
        isDeveloper: true,
        courses: [course],
        onUploaded: () => {},
        onPreview: (id, mode) => actions.push([id, mode]),
        onPublish: (id) => actions.push([id, "publish"]),
      }),
    );
  });
  act(() => {
    button(view, "Enter course").props.onClick();
    button(view, "Publish").props.onClick();
  });
  assert.deepEqual(actions, [
    ["c1", undefined],
    ["c1", "publish"],
  ]);
  await act(async () =>
    view.update(
      React.createElement(mod.DeveloperPage, {
        isDeveloper: true,
        courses: [{ ...course, status: "published" }],
        onUploaded: () => {},
        onPreview: () => {},
        onPublish: () => {},
      }),
    ),
  );
  assert.equal(button(view, "Publish"), undefined);
  view.unmount();
});

test("delayed staff identity and setup responses cannot cross logout and student login", async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const listeners = new Map();
  globalThis.window = {
    location: { hash: "#/developer" },
    history: {
      replaceState(_a, _b, hash) {
        window.location.hash = hash;
      },
    },
    addEventListener: (event, fn) => listeners.set(event, fn),
    removeEventListener: (event) => listeners.delete(event),
  };
  globalThis.document = { documentElement: {} };
  const staff = { username: "owner", isDeveloper: true };
  const student = { username: "student", isDeveloper: false };
  mod.saveAuth("staff-token", staff);
  mod.resetBackend();
  const backend = await mod.getBackend();
  let releaseMe, releaseSession;
  backend.me = () =>
    new Promise((resolve) => {
      releaseMe = resolve;
    });
  backend.listDeveloperCourses = async () => [course];
  backend.courseSetup = () =>
    new Promise((resolve) => {
      releaseSession = resolve;
    });
  backend.logout = () => new Promise(() => {});
  let view;
  await act(async () => {
    view = Renderer.create(React.createElement(mod.App));
  });
  await act(async () =>
    view.root.findByType(mod.DeveloperPage).props.onPreview("c1", "L"),
  );
  act(() => view.root.findByType(mod.TopBar).props.onLogout());
  assert.equal(view.root.findAllByType(mod.LoginPage).length, 1);
  const fresh = await mod.getBackend();
  fresh.me = async () => student;
  fresh.listCourses = async () => [];
  mod.saveAuth("student-token", student);
  await act(async () =>
    view.root.findByType(mod.LoginPage).props.onSuccess(student),
  );
  await act(async () => {
    releaseMe(staff);
    releaseSession({course, availableQuestionCount: 30, availableObjectCount: 5, kinds: [], directions: [], filters: [], testSubmitted: false});
  });
  assert.equal(view.root.findAllByType(mod.ActivityHost).length, 0);
  assert.equal(view.root.findAllByType(mod.DeveloperPage).length, 0);
  assert.equal(view.root.findByType(mod.TopBar).props.user.username, "student");
  view.unmount();
});
test("activity navigation requires confirmation and cancellation keeps activity mounted", async () => {
  let navigated = [];
  let view;
  await act(async () => {
    view = Renderer.create(
      React.createElement(
        mod.ActivityHost,
        {
          title: "Preview",
          user: { username: "owner", isDeveloper: true },
          onNavigate: (route) => navigated.push(route),
          onLogout: () => {},
          onExit: () => {},
        },
        React.createElement("p", {}, "Question"),
      ),
    );
  });
  act(() => view.root.findByType(mod.TopBar).props.onNavigate("developer"));
  assert.deepEqual(navigated, []);
  assert.equal(view.root.findAllByProps({ role: "dialog" }).length, 1);
  act(() => button(view, "Keep answering").props.onClick());
  assert.deepEqual(navigated, []);
  assert.equal(view.root.findAllByProps({ role: "dialog" }).length, 0);
  act(() => view.root.findByType(mod.TopBar).props.onNavigate("developer"));
  act(() =>
    view.root
      .findByProps({ role: "dialog" })
      .findAllByType("button")[1]
      .props.onClick(),
  );
  assert.deepEqual(navigated, ["developer"]);
  view.unmount();
});

test("stale unauthorized response does not clear a newer login", async () => {
  mod.resetBackend();
  const backend = await mod.getBackend();
  const old = { username: "old", isDeveloper: true };
  const newer = { username: "new", isDeveloper: false };
  mod.saveAuth("old-token", old);
  let deliver;
  let invalidated = 0;
  mod.setUnauthorizedHandler(() => invalidated++);
  globalThis.fetch = () =>
    new Promise((resolve) => {
      deliver = resolve;
    });
  const pending = backend.me();
  mod.saveAuth("new-token", newer);
  deliver({ status: 401 });
  await assert.rejects(pending, (e) => e.status === 401);
  assert.equal(invalidated, 0);
  assert.equal(localStorage.getItem("augenblick.auth.token"), "new-token");
  mod.setUnauthorizedHandler(null);
});
test("API routes publish, enrollment and developer preview explicitly", async () => {
  mod.resetBackend();
  const backend = await mod.getBackend();
  let calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init?.body });
    return { status: 200, ok: true, json: async () => course };
  };
  await backend.listDeveloperCourses();
  await backend.listMyCourses();
  await backend.publishCourse("c1");
  await backend.enrollCourse("c1");
  await backend.createSession({
    courseVersionId: "c1",
    mode: "L",
    preview: true,
  });
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      "/api/dev/courses/",
      "/api/my-courses/",
      "/api/dev/courses/c1/publish/",
      "/api/courses/c1/enroll/",
      "/api/sessions/",
    ],
  );
  assert.equal(JSON.parse(calls[4].body).preview, true);
});

const setup = {course, availableQuestionCount: 30, availableObjectCount: 5, kinds: [{value:"input",count:15},{value:"choice",count:15}], directions: [{value:"name-to-property",count:30}], filters: [{field:"Group",values:["A","B"]}], testSubmitted:false};
test("shared setup defaults to ten; all sends null; options and quantity are forwarded", async () => {
  mod.setLocale("en"); mod.resetBackend();
  const backend = await mod.getBackend();
  const requests = []; const starts = [];
  backend.courseSetup = async (id, config) => {requests.push(config); return {...setup, availableQuestionCount: config.kinds?.length === 0 ? 0 : 30};};
  let view;
  await act(async () => {view = Renderer.create(React.createElement(mod.CourseSetupPage,{id:"c1", onBack:()=>{}, onStart:(...args)=>starts.push(args)}));});
  assert.equal(view.root.findByProps({type:"number"}).props.value,"10");
  assert.ok(JSON.stringify(view.toJSON()).includes("Name to property"));
  act(()=>button(view,"Start").props.onClick());
  assert.equal(starts[0][2].itemCount,10);
  act(()=>view.root.findByProps({type:"number"}).props.onChange({target:{value:"3"}}));
  const checks = view.root.findAllByProps({type:"checkbox"}).filter(n=>n.props.name!=="difficultOnly");
  await act(async()=>checks[0].props.onChange());
  assert.deepEqual(requests.at(-1).kinds,["choice"]);
  act(()=>button(view,"Start").props.onClick());
  assert.deepEqual(starts[1][2],{kinds:["choice"],itemCount:3});
  act(()=>view.root.findAllByProps({name:"scope"})[1].props.onChange());
  act(()=>button(view,"Start").props.onClick());
  assert.equal(starts[2][2].itemCount,null);
  await act(async()=>view.root.findAllByProps({type:"checkbox"}).filter(n=>n.props.name!=="difficultOnly")[1].props.onChange());
  assert.equal(button(view,"Start").props.disabled,true);
  assert.equal(view.root.findAllByType("fieldset")[2].props.disabled,false);
  await act(async()=>view.root.findAllByProps({type:"checkbox"}).filter(n=>n.props.name!=="difficultOnly")[0].props.onChange());
  assert.equal(button(view,"Start").props.disabled,false);
  view.unmount();
});
test("saved setup keeps complete choices, handles failure, caps batch, translates all five locales", async()=>{
  mod.resetBackend(); const backend=await mod.getBackend();
  backend.courseSetup=async (_id,c)=>{if(c.kinds?.length===0)throw Error("invalid");return {...setup, availableQuestionCount:2000, directions:c.filters?.length?[]:setup.directions};};
  let view;
  await act(async()=>{view=Renderer.create(React.createElement(mod.CourseSetupPage,{id:"c1",initial:{config:{filters:[{field:"Group",values:["A"]}]},mode:"L",all:false,quantity:"5"},onStart:()=>{},onBack:()=>{}}));});
  assert.equal(view.root.findByProps({type:"number"}).props.max,1000);
  assert.ok(JSON.stringify(view.toJSON()).includes("Name to property"));
  for(const [locale,label] of [["zh-CN","名称 → 属性"],["pl","Nazwa → właściwość"],["ru","Название → свойство"],["ar","الاسم ← الخاصية"],["en","Name to property"]]){
    await act(async()=>mod.setLocale(locale));
    assert.ok(JSON.stringify(view.toJSON()).includes(label));
  }
  await act(async()=>view.root.findAllByProps({type:"checkbox"}).filter(n=>n.props.name!=="difficultOnly")[0].props.onChange());
  await act(async()=>view.root.findAllByProps({type:"checkbox"}).filter(n=>n.props.name!=="difficultOnly")[1].props.onChange());
  assert.equal(button(view,"Start").props.disabled,true);
  assert.equal(view.root.findAllByType("fieldset")[2].props.disabled,false);
  await act(async()=>view.root.findAllByProps({type:"checkbox"}).filter(n=>n.props.name!=="difficultOnly")[0].props.onChange());
  assert.equal(button(view,"Start").props.disabled,false);
  view.unmount();
});
test("unpublish can be cancelled and only confirmed action calls server",async()=>{
  let calls=[]; let view;
  await act(async()=>{view=Renderer.create(React.createElement(mod.DeveloperPage,{isDeveloper:true,courses:[{...course,status:"published"}],onUploaded:()=>{},onPreview:()=>{},onPublish:()=>{},onUnpublish:id=>calls.push(id)}));});
  act(()=>button(view,"Unpublish").props.onClick());
  assert.equal(view.root.findAllByProps({role:"dialog"}).length,1);
  act(()=>button(view,"Cancel").props.onClick()); assert.deepEqual(calls,[]);
  act(()=>button(view,"Unpublish").props.onClick());
  act(()=>view.root.findByProps({role:"dialog"}).findAllByType("button")[1].props.onClick());
  assert.deepEqual(calls,["c1"]);view.unmount();
});

test("refresh of encoded course deep link shows identical setup for either account role",async()=>{
  const snapshots=[];
  for(const isDeveloper of [true,false]){
    const user={username:isDeveloper?'admin':'learner',isDeveloper};
    mod.saveAuth('token-'+user.username,user);mod.resetBackend();
    const backend=await mod.getBackend();backend.me=async()=>user;
    backend.listDeveloperCourses=backend.listCourses=async()=>[course];
    backend.courseSetup=async id=>{assert.equal(id,'pl@1');return setup;};
    window.location.hash='#/course/pl%401';let view;
    await act(async()=>{view=Renderer.create(React.createElement(mod.App));});
    assert.equal(window.location.hash,'#/course/pl%401');
    const page=view.root.findByType(mod.CourseSetupPage);
    snapshots.push(JSON.stringify(page.findByProps({className:'workspace'}).findAllByType('section').map(n=>n.props.className)));
    assert.ok(button(view,'Start'));
    assert.equal(button(view,'Preview · Learn'),undefined);
    view.unmount();
  }
  assert.equal(snapshots[0],snapshots[1]);
});
test('history and difficulties routes stay accessible to both roles', () => {
 for (const isDeveloper of [true,false]) {assert.equal(mod.roleRoute({isDeveloper}, '#/history?course=c1'), 'history'); assert.equal(mod.roleRoute({isDeveloper}, '#/difficulties'), 'difficulties');}
});
test('withdraw requires confirmation; cancel preserves enrollment', async () => {
 let calls=0, view;
 await act(async()=>{view=Renderer.create(React.createElement(mod.CourseListPage,{courses:[{...course,isEnrolled:true}],view:'my-courses',onEnter:()=>{},onEnroll:()=>{},onUnenroll:()=>calls++}));});
 act(()=>button(view,'Withdraw').props.onClick());
 assert.match(JSON.stringify(view.toJSON()),/Vocabulary/);
 act(()=>button(view,'Cancel').props.onClick()); assert.equal(calls,0);
 act(()=>button(view,'Withdraw').props.onClick());
 const confirms=view.root.findAllByType('button').filter(b=>b.children.join('')==='Withdraw');
 act(()=>view.root.findByProps({role:'dialog'}).findAllByType('button').at(-1).props.onClick()); assert.equal(calls,1); view.unmount();
});
test('history reviews cancelled records without restarting sessions and handles pagination', async()=>{
 mod.setLocale('en');mod.resetBackend();const b=await mod.getBackend();let starts=0, pages=[];
 const entry={sessionId:'s1',courseVersionId:'c1',title:'Vocabulary',mode:'L',status:'cancelled',totalScore:null,createdAt:'2026-10-19T00:00:00Z',progress:{completed:1,total:3,remaining:2}};
 b.history=async (_id,page)=>{pages.push(page);return {results:[{...entry,sessionId:'s'+page}],nextPage:page===1?2:null};};
 b.createSession=async()=>{starts++;throw Error('must not start');};
 b.historyDetail=async()=>({...entry,review:[{question:{id:'q',prompt:'Name?',direction:'image-to-name',media:{kind:'image',path:'/api/media/frog.jpg'}},answer:'frog',feedback:{correctAnswers:['frog']}}]});
 let view;await act(async()=>{view=Renderer.create(React.createElement(mod.RecordsPage,{kind:'history',isDeveloper:false,onBack:()=>{},onPractice:()=>{}}));});
 await act(async()=>button(view,'More').props.onClick());assert.deepEqual(pages,[1,2]);
 await act(async()=>button(view,'Review answers').props.onClick());const content=JSON.stringify(view.toJSON());
 assert.match(content,/Cancelled/);assert.doesNotMatch(content,/Score 0/);assert.match(content,/frog/);assert.equal(view.root.findByType('img').props.src,'/api/media/frog.jpg');assert.equal(starts,0);view.unmount();
});
test('difficulties require rejoin and ignore an enrollment completing after navigation',async()=>{
 mod.resetBackend();const b=await mod.getBackend();let complete,practice=0;
 b.difficulties=async()=>[{course:{...course,status:'published'},items:[{objectId:'x',name:'Frog'}]}];
 b.enrollCourse=()=>new Promise(resolve=>complete=resolve);
 let view;await act(async()=>{view=Renderer.create(React.createElement(mod.RecordsPage,{kind:'difficulties',isDeveloper:false,onBack:()=>{},onPractice:()=>practice++}));});
 await act(async()=>button(view,'Rejoin course').props.onClick());assert.equal(practice,0);
 await act(async()=>view.unmount());await act(async()=>complete(course));assert.equal(practice,0);
});
test('difficult-only setup preserves options with no questions and forwards filter',async()=>{
 mod.resetBackend();const b=await mod.getBackend();let config,started;
 b.courseSetup=async (_id,c)=>{config=c;return {...setup,availableQuestionCount:c.difficultOnly?0:30};};
 let view;await act(async()=>{view=Renderer.create(React.createElement(mod.CourseSetupPage,{id:'c1',initial:{config:{difficultOnly:true},quantity:'10',mode:'L',all:false},onBack:()=>{},onStart:(_m,_t,c)=>started=c}));});
 assert.equal(config.difficultOnly,true);assert.equal(button(view,'Start').props.disabled,true);
 await act(async()=>view.root.findByProps({name:'difficultOnly'}).props.onChange({target:{checked:false}}));assert.equal(button(view,'Start').props.disabled,false);
 act(()=>button(view,'Start').props.onClick());assert.equal(started.difficultOnly,false);view.unmount();
});
test('records load failures are visible and retry; unpublished content cannot be practiced',async()=>{
 mod.setLocale('en');mod.resetBackend();const b=await mod.getBackend();let fail=true;
 b.difficulties=async()=>{if(fail)throw Error('offline');return [{course:{...course,status:'draft'},items:[{objectId:'x',name:'Frog'}]}];};
 let view;await act(async()=>{view=Renderer.create(React.createElement(mod.RecordsPage,{kind:'difficulties',isDeveloper:false,onBack:()=>{},onPractice:()=>assert.fail('must not practice')}));});
 assert.equal(view.root.findAllByProps({role:'alert'}).length,1);fail=false;await act(async()=>button(view,'Retry').props.onClick());
 assert.match(JSON.stringify(view.toJSON()),/Course unpublished/);assert.equal(button(view,'Practice'),undefined);assert.equal(button(view,'Rejoin course'),undefined);view.unmount();
});
test('history and difficulty navigation translates in every locale',async()=>{
 for(const locale of ['zh-CN','en','pl','ru','ar']){mod.setLocale(locale);let view;await act(async()=>{view=Renderer.create(React.createElement(mod.TopBar,{user:{username:'admin',isDeveloper:true},onNavigate:()=>{},onLogout:()=>{}}));});const nav=view.root.findByType('nav');assert.equal(nav.findAllByType('button').length,3);for(const b of nav.findAllByType('button'))assert.ok(b.children.join('').length>0);assert.doesNotMatch(JSON.stringify(view.toJSON()),/nav\.history|nav\.difficulties/);view.unmount();}mod.setLocale('en');
});
