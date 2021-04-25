# playwright-redmine

This NPM package helps users programmatically execute some of the UI operations of Redmine. The goal is to provide a way to automate testing and other manual tasks which Redmine does not currently provide APIs for, although this will change as the time goes on, i.e. more APIs will be added later.

playwright-redmine provides methods for the following Redmine features:

- Creating/deleting authentication modes
- Archiving/unarchiving projects
- Create trackers
- Create issue custom fields
- Get the list of installed plugins
- (plus a few more methods for UI operations)

```js
const { chromium } = require('playwright');

(async () => {

  const browser = await chromium.launch();
  const context = await browser.newContext();

  redmine = redminePlaywright.Redmine('http://localhost:3000', context);

  await redmine.signInToRedmine('admin', 'passwordinplaintext');

  // Create an authentication mode
  await redmine.createAuthenticationMode({
    name: authenticationModeName,
    host: "nyanko.io",
    port: 389,
    loginAttribute: "awww",
    baseDn: "awww"
  });

  // Create a tracker
  await redmine.createTracker({
    name: 'Pending Approval',
    defaultStatus: 'In Progress',
    description: 'This tracker is chonky'
    // issuesDisplayedInRoadmap: true,
  });

  // Add files to a project
  await redmine.addFiles([
    {
      path: 'awww.txt',
      description: 'Awww text file'
    },
    {
      path: 'purr.png',
      description: 'Awww image file'
    }
  ]);

  // Archive a project
  const projectIdentifier = 'awww-project';
  await redmine.archiveProject(projectIdentifier);

  // Unarchive a project
  await redmine.unarchiveProject(projectIdentifier);

  // Create a repository
  await redmine.createRepository(projectIdentifier,{
    scm: 'Git',
    mainRepository: true,
    repositoryIdentifier: 'awww-git-repo',
    pathToRepository: '/srv/git/awww.git'
  });

})();

```