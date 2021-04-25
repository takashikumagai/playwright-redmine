const { chromium } = require('playwright');
const redminePlaywright = require('./playwright-redmine');
const fs = require('fs');

const projectIdentifier = 'playwright_public_project';
const privateProjectIdentifier = "playwright_private_project";
const testProjectIdentifier = "playwright";
const trackerName = 'chonky-tracker';
const anotherTrackerName = 'wonky-tracker';
const authenticationModeName = 'Awww-authentication-mode';
const secondaryAuthenticationModeName = 'Awww-another-authentication-mode';
const users = [
  {
    login: 'heftychonk',
    firstname: 'Hefty',
    lastname: 'Chonk',
    email: 'heftychonk@chonkmail.com',
    passwordInPlaintext: 'thiscatischonky'
  },
  {
    login: 'megachonker',
    firstname: 'Mega',
    lastname: 'Chonker',
    email: 'megachonker@chonkmail.com',
    passwordInPlaintext: 'thiscatischonky'
  },
  {
    login: 'oh-lawd-he-comin',
    firstname: 'oh-lawd',
    lastname: 'he-comin',
    email: 'ohlawdhecomin@chonkmail.com',
    passwordInPlaintext: 'thiscatischonky',
    isAdministrator: true
  },
  {
    login: 'oh-lawd-he-comin-2.0',
    firstname: 'oh-lawd',
    lastname: 'he-comin',
    email: 'ohlawdhecomin2@chonkmail.com',
    passwordInPlaintext: 'thiscatischonky',
    isAdministrator: true
  }
];

let redmineUrl = null;
let redmine = null;
let browser = null;
let context = null;
// let apiKey = null;

async function takeScreenshot(context, url, imageFilename) {
  const page = await context.newPage();
  await page.goto(url);
  await page.screenshot({ path: `screenshots/${imageFilename}` });
}

async function clean(context, redmineUrl, redmine) {
  await redmine.deleteProject(projectIdentifier);
  await redmine.deleteProject(privateProjectIdentifier);
 
  await redmine.deleteTracker(trackerName);
  await redmine.deleteTracker(anotherTrackerName);

  await redmine.deleteAuthenticationModeByName(authenticationModeName);

  for(let user of users) {
    await redmine.deleteUser(user.login);
  }

  takeScreenshot(context, `${redmineUrl}/users`, 'there-should-be-no-test-users.png');

  // await redmine.deleteUser();
}

beforeAll(async (done) => {
  browser = await chromium.launch();
  context = await browser.newContext();

  redmineUrl = process.env.PLAYWRIGHT_REDMINE_URL;
  redmine = redminePlaywright.Redmine(redmineUrl, context);

  await redmine.signInToRedmine(
    process.env.PLAYWRIGHT_REDMINE_LOGIN,
    process.env.PLAYWRIGHT_REDMINE_PASSWORD);

  // apiKey = await redmine.getApiAccessKey();
  // console.log('API key:',apiKey);

  let ver = await redmine.getRedmineVersionInfo();
  console.log(ver);

  // await clean(context, redmineUrl, redmine);

  const page = await context.newPage();
  await page.goto(`${redmineUrl}/admin`);
  const notYetConfigured = await page.$('form[action="/admin/default_configuration"]');
  if(notYetConfigured) {
    await page.click('input[name="commit"][type="submit"]');
  }

  await redmine.createProject({
    projectName: testProjectIdentifier,
    projectDescription: "This hosts authentication modes and repositories for testing",
    projectIdentifier: testProjectIdentifier,
    homepage: 'https://myneighbornyanko.club'
  });

  done();
}, 5000);

afterAll(async (done) => {
  await redmine.deleteProject(testProjectIdentifier);
  await browser.close();
  done();
});

describe('Test projects', () => {

  test('Create projects', async (done) => {
    const numInitialProjects = await redmine.getNumProjects();
    await redmine.createProject({
      projectName: "Playwright public project",
      projectDescription: "Awww",
      projectIdentifier: projectIdentifier,
      homepage: 'https://myneighbornyanko.io'
    });

    let numProjects = await redmine.getNumProjects();
    expect(numProjects).toBe(numInitialProjects + 1);

    // Private project
    await redmine.createProject({
      projectName: "Playwright private project",
      projectDescription: "Awww describing a private project",
      projectIdentifier: privateProjectIdentifier,
      homepage: 'nyankovsky.io',
      isPublic: false
    });

    numProjects = await redmine.getNumProjects();
    expect(numProjects).toBe(numInitialProjects + 2);

    // await takeScreenshot(
    //   context,
    //   `${redmineUrl}/admin/projects`,
    //   'there-should-be-2-test-projects.png');

    done();
  });

  test('Delete projects', async (done) => {
    const numInitialProjects = await redmine.getNumProjects();
    await redmine.deleteProject(projectIdentifier);
    await redmine.deleteProject(privateProjectIdentifier);

    let numProjects = await redmine.getNumProjects();
    expect(numProjects).toBe(numInitialProjects - 2);

    done();
  });

  // test('Archive and unarchive projects', async () => {
  //   await redmine.archiveProject(projectIdentifier);

  //   // await takeScreenshot(
  //   //   context,
  //   //   `${redmineUrl}/admin/projects?utf8=✓&status=&name=`,
  //   //   'there-should-be-2-archived-projects.png');

  //   await redmine.unarchiveProject(projectIdentifier);
  // });
});

describe('Test issues', () => {

  let issueId = null;
  let anotherIssueId = null;
  test('Create issues', async () => {
    issueId = await redmine.createIssue(testProjectIdentifier, {
      subject: "awww issue",
      description: "This cat is stuck"
    });
    // console.log('Issue created:', issueId);
    anotherIssueId = await redmine.createIssue(testProjectIdentifier, {
      subject: "another issue",
      description: "This cat is stuck\nThis cat is flonfy"
    });
    // console.log('Issue created:', anotherIssue);

    // await takeScreenshot(
    //   context,
    //   `${redmineUrl}/projects/${projectIdentifier}/issues`,
    //   'there-should-be-awww-issue.png');

    expect(await redmine.getNumIssues(testProjectIdentifier)).toBe(2);
  });

  test('Delete issues', async () => {
    await redmine.deleteIssue(issueId);
    await redmine.deleteIssue(anotherIssueId);

    expect(await redmine.getNumIssues(testProjectIdentifier)).toBe(0);
  });
});

describe('Test trackers', () => {

  test('Create trackers', async () => {
    const numInitialTrackers = (await redmine.getTrackers()).length;
    await redmine.createTracker({
      name: trackerName,
      defaultStatus: 'In Progress',
      description: 'This tracker is chonky'
      // issuesDisplayedInRoadmap: true,
    });
    // await redmine.createTracker({
    //   name: anotherTrackerName,
    //   defaultStatus: 'In Progress',
    //   description: 'This tracker is wonky',
    //   copyWorkflowFrom: 'Feature'
    //   // issuesDisplayedInRoadmap: true,
    // });
    expect((await redmine.getTrackers()).length).toBe(numInitialTrackers + 1);
  });

  test('Delete trackers', async () => {
    const numInitialTrackers = (await redmine.getTrackers()).length;
    await redmine.deleteTracker(trackerName);
    // await redmine.deleteTracker(anotherTrackerName);  
    expect((await redmine.getTrackers()).length).toBe(numInitialTrackers - 1);
  });
});

describe('Test issue statuses', () => {

  test('Create issue statuses', async () => {
    await redmine.createIssueStatus({
      name: 'Chonky'
    });
    await redmine.createIssueStatus({
      name: 'Wonky',
      issueClosed: true
    });

    const page = await context.newPage();
    await page.goto(`${redmineUrl}/issue_statuses`);
    const chonky = await page.$('table.list.issue_statuses >> tbody >> text="Chonky"');
    expect(chonky).not.toBe(null);
    const wonky = await page.$('table.list.issue_statuses >> tbody >> text="Wonky"');
    expect(wonky).not.toBe(null);
  });

  test('Delete issue statuses', async () => {
    await redmine.deleteIssueStatus('Chonky');
    await redmine.deleteIssueStatus('Wonky');

    const page = await context.newPage();
    await page.goto(`${redmineUrl}/issue_statuses`);
    const chonky = await page.$('table.list.issue_statuses >> tbody >> text="Chonky"');
    expect(chonky).toBe(null);
    const wonky = await page.$('table.list.issue_statuses >> tbody >> text="Wonky"');
    expect(wonky).toBe(null);
  });
});

describe('Test custom fields', () => {

  const cfForAllProjects = 'pw-test (for all projects)';
  const cfForSomeProjects = 'pw-test (not for all projects)';
  // let chonkyCfId = null;
  // let flonfyCfId = null;
  test('Create issue custom fields', async () => {
    // chonkyCfId =
    await redmine.createCustomField({
      type: 'Issue',
      formatName: 'Text',
      name: cfForAllProjects,
      description: 'This cat is C H O N K Y',
      forAllProjects: true
    });

    // flonfyCfId =
    await redmine.createCustomField({
      type: 'Issue',
      formatName: 'Text',
      name: cfForSomeProjects,
      description: 'This cat is F L O N F Y',
      forAllProjects: false
    });

    const page = await context.newPage();
    await page.goto(`${redmineUrl}/custom_fields`);
    const chonky = await page.$(`table.list.custom_fields >> tbody >> text="${cfForAllProjects}"`);
    expect(chonky).not.toBe(null);
    const flonfy = await page.$(`table.list.custom_fields >> tbody >> text="${cfForSomeProjects}"`);
    expect(flonfy).not.toBe(null);

    // await takeScreenshot(
    //   context,
    //   `${redmineUrl}/custom_fields`,
    //   'there-should-be-2-test-custom-fields.png');
  });

  test('Delete issue custom fields', async () => {
    // await redmine.deleteCustomFieldById(chonkyCfId);
    await redmine.deleteCustomFieldByTypeAndName('Issue', cfForAllProjects);

    const page = await context.newPage();
    await page.goto(`${redmineUrl}/custom_fields`);
    const chonky = await page.$(`table.list.custom_fields >> tbody >> text="${cfForAllProjects}"`);
    expect(chonky).toBe(null);

    // await redmine.deleteCustomFieldById(flonfyCfId);
    await redmine.deleteCustomFieldByTypeAndName('Issue', cfForSomeProjects);

    await page.goto(`${redmineUrl}/custom_fields`);
    const flonfy = await page.$(`table.list.custom_fields >> tbody >> text="${cfForSomeProjects}"`);
    expect(flonfy).toBe(null);

    // await takeScreenshot(
    //   context,
    //   `${redmineUrl}/custom_fields`,
    //   'there-should-be-no-test-custom-fields.png');
  });
});

describe('Test authentication modes', () => {

  test('Create authentication modes', async () => {
    expect(await redmine.getNumAuthenticationModes()).toBe(0);
    await redmine.createAuthenticationMode({
      name: authenticationModeName,
      host: "nyanko.io",
      port: 1234,
      loginAttribute: "meow",
      baseDn: "catto"
    });
    await redmine.createAuthenticationMode({
      name: secondaryAuthenticationModeName,
      host: "nyanko.club",
      port: 2345,
      loginAttribute: "meowmeowmeow",
      baseDn: "catto",
      account: "meow",
      timeoutInSecounds: 987,
      firstnameAttribute: "A",
      lastnameAttribute: "B",
      emailAttribute: "C"
    });
    expect(await redmine.getNumAuthenticationModes()).toBe(2);

    // await takeScreenshot(
    //   context,
    //   `${redmineUrl}/auth_sources`,
    //   'there-should-be-2-test-authentication-modes.png');
  });

  test('Delete authentication modes', async () => {
    expect(await redmine.getNumAuthenticationModes()).toBe(2);
    await redmine.deleteAuthenticationModeByName(secondaryAuthenticationModeName);
    await redmine.deleteAuthenticationModeByName(authenticationModeName);
    expect(await redmine.getNumAuthenticationModes()).toBe(0);

    // await takeScreenshot(
    //   context,
    //   `${redmineUrl}/auth_sources`,
    //   'there-should-be-no-test-authentication-modes.png');
  });
});

describe('test file methods', () => {

  const awwwFile = 'awww.txt';
  const wonkyFile = 'wonky.txt';

  beforeAll(() => {
    fs.writeFile(awwwFile, 'awww', err => {if(err) console.error(err);});
    fs.writeFile(wonkyFile, 'wonky', err => {if(err) console.error(err);});
  });

  test('Add files', async () => {
    const files = [
      {
        path: awwwFile,
        description: 'awww text file'
      },
      {
        path: wonkyFile,
        description: 'awww text file (wonky)'
      }
    ];
  
    await redmine.addFiles(testProjectIdentifier, files);

    const page = await context.newPage();
    await page.goto(`${redmineUrl}/projects/${testProjectIdentifier}/files`);
    const awww = await page.$(`table.list.files  >> tbody >> text="${awwwFile}"`);
    expect(awww).not.toBe(null);
    const wonky = await page.$(`table.list.files  >> tbody >> text="${wonkyFile}"`);
    expect(wonky).not.toBe(null);

    // await takeScreenshot(
    //   context,
    //   `${redmineUrl}/projects/${projectIdentifier}/files`,
    //   'there-should-be-2-test-files.png');
  });

  // test('Delete files', async () => {
  //   await redmine.deleteFile(projectIdentifier, 'awww.txt');
  //   await redmine.deleteFile(projectIdentifier, 'wonky.txt');

    // await takeScreenshot(
    //   context,
    //   `${redmineUrl}/projects/${projectIdentifier}/files`,
    //   'there-should-be-no-test-files.png');
  // });
});

describe('test repository methods', () => {

  test('Create repositories', async () => {
    const repoIdentifier = 'playwright-redmine-git-repo';
    await redmine.createRepository(testProjectIdentifier,{
      scm: 'Git',
      mainRepository: true,
      repositoryIdentifier: repoIdentifier,
      pathToRepository: '/srv/git/awww.git'
    });

    const page = await context.newPage();
    await page.goto(`${redmineUrl}/projects/${testProjectIdentifier}/settings/repositories`);
    await page.click('#tab-repositories');
    const repo = await page.$(`#tab-content-repositories >> table.list >> tbody >> text="${repoIdentifier}"`);
    expect(repo).not.toBe(null);
  });
});

describe('test settings methods', () => {
  test('Update settings', async () => {
    const applicationTitle = 'patto ur catto';
    const welcomeText = 'This cat is C H O N K Y';
    await redmine.updateSettings({
      general: {
        applicationTitle: applicationTitle,
        welcomeText: welcomeText,
        searchResultsPerPage: 23
      },
      api: {
        enableRestApi: true
      },
      files: {
        maximumAttachmentSizeInKB: 5678
      }
    });

    const page = await context.newPage();
    await page.goto(`${redmineUrl}`);
    const title = await page.evaluate(el => el.innerText, await page.$('h1'));
    expect(title).toBe(applicationTitle);
    const p = await page.$(`#content >> div.wiki >> text="${welcomeText}"`);
    expect(p).not.toBe(null);
    await page.goto(`${redmineUrl}/settings?tab=api`);
    const restApiCheckbox = await page.$('#settings_rest_api_enabled');
    const enabled = await restApiCheckbox.evaluate(node => node.checked);
    expect(enabled).toBe(true);
  });
});
