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
      contents: `export {App} from './src/shell/App'; export {LoginPage} from './src/shell/LoginPage'; export {ActivityHost} from './src/host/ActivityHost'; export {saveAuth} from './src/orchestrator/auth'; export {TopBar} from './src/shell/TopBar'; export {DeveloperPage} from './src/shell/DeveloperPage'; export {CourseListPage} from './src/shell/CourseListPage'; export {roleRoute} from './src/orchestrator/routes'; export {validateUpload, uploadCourseFile} from './src/orchestrator/upload'; export {setLocale} from './src/i18n'; export {getBackend,resetBackend,setUnauthorizedHandler} from './src/orchestrator/api';`,
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
test("catalog joins; owned library exposes learning and testing only", async () => {
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
  assert.ok(button(view, "Learn"));
  assert.ok(button(view, "Test"));
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
test("developer draft actions preview each mode and publish, published row cannot publish again", async () => {
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
    button(view, "Preview · Learn").props.onClick();
    button(view, "Preview · Test").props.onClick();
    button(view, "Publish").props.onClick();
  });
  assert.deepEqual(actions, [
    ["c1", "L"],
    ["c1", "T"],
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

test("delayed staff identity and preview responses cannot cross logout and student login", async () => {
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
  backend.createSession = () =>
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
    releaseSession({ sessionId: "old-preview", mode: "L", isPreview: true });
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
