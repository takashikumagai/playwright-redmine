const { chromium } = require('playwright');

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function getHrefPrefix(url) {
  const path = (new URL(url)).pathname;
  if(path === '/') {
    return '';
  } else {
    return path; // example: /awww/path, i.e. starts with '/' and ends without trailing '/'
  }
}

async function fillOutNewUserForm(page, properties) {
  // Required fields
  await page.fill('#user_login', properties.login);
  await page.fill('#user_firstname', properties.firstname);
  await page.fill('#user_lastname', properties.lastname);
  await page.fill('#user_mail', properties.email);
  await page.fill('#user_password', properties.passwordInPlaintext);
  await page.fill('#user_password_confirmation', properties.passwordInPlaintext);

  if(properties.isAdministrator) {
    await page.check('#');
  }
  if(properties.language) {
    let selectElement = await page.$('#user_language');
    await selectElement.selectOption(properties.language);
  }
  if(properties.authenticationMode) {
    let authMode = await page.$('#');
    await authMode.selectOption({label: properties.authenticationMode});
  }
}

function isVersionSameWithOrHigherThan(actual, queried, i) {

  if(actual.length <= i || !isNumeric(actual[i])
   || queried.length <= i || !isNumeric(queried[i])) {
      return true;
  }

  if(actual[i] > queried[i]) {
      return true;
  } else if(actual[i] == queried[i]) {
      return isVersionSameWithOrHigherThan(actual, queried, i+1);
  } else {
      return false;
  }
}

module.exports = {

  Redmine: function(redmineUrl, context) {
    this.redmineUrl = redmineUrl;
    this.context = context;
    return this;
  },

  signInToRedmine: async function(login, passwordInPlaintext) {
    // Open the Redmine login page
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/login`);

    // Sign in to Redmine
    await page.fill('#username', login);
    await page.fill('#password', passwordInPlaintext);
    await page.click('input[type="submit"][name="login"]');

    return page;
  },

  signOutFromRedmine: async function() {
    const page = await this.context.newPage();
    await page.goto(this.redmineUrl);
    await page.click('a.logout');
  },

  isSignedIn: async function() {
    const page = await this.context.newPage();
    await page.goto(this.redmineUrl);
    return $('#loggedas').isExisting();
  },

  /**
   * 
   * @param {*} isoLanguageCode ISO language code
   */
  setUserLanguage: async function(isoLanguageCode) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/my/account`);

    let selectElement = await page.$('select#user_language');
    await selectElement.selectOption(isoLanguageCode);

    await page.click('css=p.mobile-hide >> css=input[type="submit"][name="commit"]');
  },

  getApiAccessKey: async function() {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/my/account`);

    // Show the API key (click the Show link)
    const sidebar = await page.$('#sidebar');
    const show = await sidebar.$('a[data-remote="true"]');
    await show.click();

    const pre = await page.$('#api-access-key');
    return await page.evaluate(el => el.innerText.trim(), pre);
  },

  resetApiAccessKey: async function() {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/my/account`);

    // Show the API key (click the Show link)
    const sidebar = await page.$('#sidebar');
    const show = await sidebar.$('a[data-remote="true"]');
    await show.click();

    // Click Reset
    const hrefPrefix = getHrefPrefix(this.redmineUrl);
    const reset = await page.$(`a[data-method="post"][href="${hrefPrefix}/my/api_key"]`);
    await reset.click();

    const pre = await page.$('#api-access-key');
    return await page.evaluate(el => el.innerText.trim(), pre);
  },

  /**
   * Return an array representing the Redmine version info
   * - Example: if Redmine is ver. 3.4.10.stable, the return value is [3, 4, 10, 'stable']
   * - Note that version numbers are integers whereas 'stable' is a string.
   */
  getRedmineVersionInfo: async function() {
    const page = await this.context.newPage();
    // const cookies = await this.context.cookies();
    // console.log(cookies);
    await page.goto(`${this.redmineUrl}/admin/info`);
    let element = await page.$('css=div#content >> css=p >> css=strong');
    let text = await page.evaluate(el => el.innerText.trim(), element);

    // console.log(`Redmine version info: ${text}`);

    // text typically contains a string such as 'Redmine 4.1.2.stable'
    let versionInfo = text.split(' ')[1].split('.');
    // So versionInfo is an array that looks like this: ['4', '1', '2', 'stable']
    return versionInfo.map(a => {return isNumeric(a) ? parseInt(a) : a;})
  },

  /**
  *
  * @param {*} queriedVersion a string representing the version you are quering, e.g. '4.2.1'
  */
  isRedmineVersionSameWithOrHigherThan: async function(queriedVersion) {

    const redmineVersionInfo = await this.getRedmineVersionInfo();

    // Split to convert the string representation into an int array
    // Example: '4.0.1' -> [4, 0, 1]
    let queried = queriedVersion.split('.').map(a => {return isNumeric(a) ? parseInt(a) : 0});

    // Zero-pad the integer array
    while(queried.length < redmineVersionInfo.length) {
      queried.push(0);
    }

    return isVersionSameWithOrHigherThan(redmineVersionInfo, queried, 0);
  },

  /**
   * @brief Creates an issue in the specified project
   * 
   * @param {*} projectIdentifier 
   * @param {*} issue 
   * 
   * @return Issue ID
   */
  createIssue: async function(projectIdentifier, issue) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/issues/new`);

    if(issue.subject) {
      await page.fill('input#issue_subject', issue.subject);
    } else {
      return;
    }

    if(issue.tracker) {
      let selectElement = await page.$('select#issue_tracker_id');
      await selectElement.selectOption({label: issue.tracker});
    } else {
      // return;
    }

    if(issue.description) {
      await page.fill('textarea#issue_description', issue.description);
    }

    if(issue.customFields) {
      const cfNames = Object.keys(issue.customFields);
      // console.log('cfNames',cfNames);
      const attribDiv = await page.$('div#attributes');
      for(let cfName of cfNames) {
        // Each custom field looks like this in the DOM:
        // <p>
        //   <label>
        //     <span>CustomFieldName</span>
        //   </label>
        //   <input>
        // </p>
        // console.log('cfName',cfName);
        let span = await attribDiv.$(`span=${cfName}`);
        let label = await span.$('..');
        let p = await label.$('..');
        let input = await p.$('input');
        await input.fill(issue.customFields[cfName]);
      }
    }

    await page.click('input[name="commit"][type="submit"][value="Create"]');

    flashNotice = await page.$('#flash_notice');

    // Get the issue number prefixed with '#'
    let issueNumber = await page.evaluate(el => el.innerText, await flashNotice.$('a'));
    // console.log(`New issue ${issueNumber}`);

    // Drop the '#' prefix and convert the string into an intger
    return parseInt(issueNumber.substring(1));
  },

  /**
   * @brief Deletes an issue
   * 
   * @param {*} issueId 
   */
  deleteIssue: async function(issueId) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/issues/${issueId}`);

    page.on('dialog', async (dialog) => {
      // console.debug(dialog.message());
      await dialog.accept();
    });

    if(await this.isRedmineVersionSameWithOrHigherThan('4.2')) {
      await page.click('span.icon-only.icon-actions');
    }

    await page.click('a.icon.icon-del');
  },

  getNumIssues: async function(projectIdentifier) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/issues`);

    const pagination = await page.$('span.pagination');

    if(pagination == null) {
      // The pagination element does not exist when there is no issue
      // in the project.
      return 0;
    }
  
    // Wait for 5 seconds (safety margin in case the issue list page is not instantly loaded)
    // pagination.waitForExist(5000, false, "waitForExist timed out (getNumIssues)");

    const span = await pagination.$('span.items');
    const pageInfo = await page.evaluate(el => el.innerText, span);

    // pageInfo contains pages and the number of issues in this format:
    // (26-50/120)
    const numIssuesStr = pageInfo.split('/')[1].slice(0,-1);
    return parseInt(numIssuesStr, 10);
  },

  createTracker: async function(properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/trackers`);
    await page.click('a.icon.icon-add');

    await page.fill('input#tracker_name', properties.name);

    if(properties.defaultStatus) {
      let selectElement = await page.$('#tracker_default_status_id');
      await selectElement.selectOption({label: properties.defaultStatus});
    }

    if(properties.description) {
      await page.fill('#tracker_description', properties.description);
    }

    if(properties.copyWorkflowFrom) {
      let selectElement = await page.$('#copy_workflow_from');
      await selectElement.selectOption({label: properties.copyWorkflowFrom});
    }

    // Default tracker (required field)
    // await page.click('css=select#tracker_default_status_id >> css=option[value="1"]');

    await page.click('input[type="submit"][name="commit"]');
  },

  deleteTracker: async function(trackerName) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/trackers`);

    let a = await page.$(`table.list.trackers >> tbody >> text="${trackerName}"`);

    if(a) {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Get the parent element in the DOM tree
      let td = await a.$('..');
      let tr = await td.$('..');

      // Click the trash can icon
      let del = await tr.$('css=td.buttons >> css=a.icon.icon-del');
      await del.click();

      // browser.acceptAlert(); // Confirmation dialog - click 'Yes'
    } else {
      console.debug(`The tracker '${trackerName}' does not exist
      or this Redmine has a different DOM tree structure, e.g. due to
      differences in versions.`);
    }
  },

  getTrackers: async function() {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/trackers`);

    const tbody = await page.$('table.list.trackers >> tbody');
    const rows = await tbody.$$('tr');
    let trackers = [];
    for(let row of rows) {
      trackers.push({
        name: await page.evaluate(el => el.innerText, await row.$('td.name >> a'))
      });
    }
    return trackers;
  },

  enableTrackerForProject: async function(trackerName, projectName) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/trackers`);

    // Navigate to the tracker edit page
    await page.click(`a[text="${trackerName}"]`);

    // On the tracker edit page, enable the tracker for the test project
    // checkCheckbox($(`label=${projectName}`).$('input'));
    checkCheckbox($(`label=${projectName}`).$('input'));

    await page.click('input[type="submit"][name="commit"]');
  },

  /**
   * @brief Creates a custom field
   * 
   * @param {*} properties 
   * type: Issue, etc.
   * format: string, etc.
   */
  createCustomField: async function(properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/custom_fields/new`);
    
    let radioButton = await page.$(`input#type_${properties.type}CustomField`);
    if(radioButton) {
      await radioButton.click();
    } else {
      console.log('Invalid custom field type:', properties.type);
      return;
    }
    await page.click('input[type="submit"]');

    // The click should take us to the 'New custom field' page

    await page.fill('#custom_field_name', properties.name); // required

    let formatSelectElement = await page.$('#custom_field_field_format');
    if(properties.format) {
      await formatSelectElement.selectOption(properties.format);
    } else if(properties.formatName) {
      await formatSelectElement.selectOption({label: properties.formatName});
    }
    // console.log(`Selected format: ${await page.evaluate(el => el.innerText, await formatSelectElement.$('option[selected="selected"]'))}`);

    if(properties.description) {
      await page.fill('#custom_field_description', properties.description);
    }
    if(properties.forAllProjects) {
      await page.check('#custom_field_is_for_all');
    }
  
    // await page.screenshot({ path: 'screenshots/redmine-playwright-cf.png' });

    await page.click('input[type="submit"][name="commit"]');

    // const url = await page.url();
    // console.log(`Page URL after creating custom field: ${url}`);

    // Commented out: before Redmine 4.2, the page URL changes to something like this:
    // https://chonky.club/redmine/custom_fields/3/edit
    // where https://chonky.club/redmine is stored in this.redmineUrl
    // After a custom field is successfully created,
    // The URL does not change like this any more starting with Redmine 4.2
    // let customFieldIdAndRest = url.substring(`${this.redmineUrl}/custom_fields/`.length);

    // customFieldidAndRest is cf id + the rest of the URL, e.g. 3/edit
    // customFieldId = Number(/([0-9]+)\/edit/g.exec(customFieldIdAndRest)[1]);
    // console.log('Custom field ID:', customFieldId);
    // return customFieldId;
  },

  deleteCustomFieldById: async function(customFieldId) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/custom_fields`);

    table = await page.$('table.list.custom_fields');
    if(table != null) {
      tbody = await table.$('tbody');
      const hrefPrefix = getHrefPrefix(this.redmineUrl);
      let a = await tbody.$(`a[href="${hrefPrefix}/custom_fields/${customFieldId}/edit"]`);
      if(a) {
        // console.log(`Found custom field ${customFieldId}`);

        let td = await a.$('..');
        let tr = await td.$('..');
        let del = await tr.$('a.icon.icon-del');
  
        page.on('dialog', async (dialog) => {
          await dialog.accept();
        });

        await del.click();
      }
    } else {
      return;
    }

  },

  /**
   * Deletes a custom field (type and name)
   * 
   * @param {*} customFieldName 
   * @param {*} type Required because custom fields with the same name are allowed if they are different types.
   */
  deleteCustomFieldByTypeAndName: async function(type, customFieldName) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/custom_fields`);

    await page.click(`a#tab-${type}CustomField`);

    const a = await page.$(`table.list.custom_fields >> tbody >> text="${customFieldName}"`);
    if(a) {
      console.log(`Found custom field ${customFieldName}`);

      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Go up the DOM tree: a -> td -> tr
      let td = await a.$('..');
      let tr = await td.$('..');
      let del = await tr.$('a.icon.icon-del');
      await del.click();

      // dialog response callback above will be called and click yes
    } else {
      console.log(`No custom field with name ${customFieldName} was found.`);
    }
  },

  createProject: async function(properties) {

    if(!properties || !properties.projectName) {
      console.log('Invalid project properties');
      return;
    }

    // Go to the 'Projects' page and create a test project
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects`);
    await page.click('a.icon.icon-add');

    // 'New project' page
    await page.fill('#project_name', properties.projectName);
    if(properties.projectDescription) {
      await page.fill('#project_description', properties.projectDescription);
    }
    if(properties.projectIdentifier) {
      await page.fill('#project_identifier', properties.projectIdentifier);
    }
    if(properties.homepage) {
      await page.fill('#project_homepage', properties.homepage);
    }
    if(properties.isPublic) {
      await page.check('#project_is_public');
    } else {
      await page.uncheck('#project_is_public');
    }
    if(properties.subprojectOf) {
      const subprojectOf = await page.$('#project_parent_id');
      await subprojectOf.selectOption(properties.subprojectOf);
    }

    // Click the 'Create' button
    await page.click('input[type="submit"][name="commit"]');
  },

  editProjectSettings: async function(projectIdentifier, properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/settings`);
  },

  deleteProject: async function(projectIdentifier) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/admin/projects`);

    const hrefPrefix = getHrefPrefix(this.redmineUrl);
    let a = await page.$(`a.icon.icon-del[href="${hrefPrefix}/projects/${projectIdentifier}"]`);
    if(a) {
      // console.log(`Found project ${projectIdentifier}`);

      await a.click();

      // 'Confirmation' page
      if(await this.isRedmineVersionSameWithOrHigherThan('4.2')) {
        // console.log('Redmine 4.2 or higher');
        // 4.2 or above: redmine requires you to enter the project identifier, like GitHub
        await page.fill('input#confirm', projectIdentifier);
        // Click the 'Delete' button
        // console.log('Deleting',projectIdentifier);
        await page.click('input[type="submit"][name="commit"]');
      } else {
        // 4.1 or earlier: a simple check box
        let confirmButton = await page.$('input#confirm');
        await confirmButton.check(); // Note that this does nothing is the checkbox is already checked.
        // Click the 'Delete' button
        await page.click('input[type="submit"][name="commit"]');
      }
    } else {
      console.log(`Project ${projectIdentifier} was not found so not deletin anythin`);
    }
  },

  getNumProjects: async function() {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/admin/projects`);

    const span = await page.$('span.pagination >> span.items');
    const text = await page.evaluate(el => el.innerText, span);
    // console.log('Projects',text);
    const numProjects = text.split('/')[1].slice(0,-1);
    return parseInt(numProjects, 10);
  },

  projectExists: async function(projectIdentifier) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/admin/projects`);

    const hrefPrefix = getHrefPrefix(this.redmineUrl);
    const a = await page.$(`table.list >> tbody >> a[href="${hrefPrefix}/projects/${projectIdentifier}"]`);
    return (a != null);
  },

  /**
   * @brief Archives a project
   * 
   * @param {*} projectIdentifier 
   */
  archiveProject: async function(projectIdentifier) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/admin/projects`);

    const hrefPrefix = getHrefPrefix(this.redmineUrl);
    let a = await page.$(`a[href="${hrefPrefix}/projects/${projectIdentifier}"]`);
    if(a) {
      // console.log(`Found project ${projectIdentifier}`);

      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Go up the DOM tree: a -> span -> td -> tr
      let span = await a.$('..');
      let td = await span.$('..');
      let tr = await td.$('..');
      let archive = await tr.$('a.icon.icon-lock');
      await archive.click();

      // dialog response callback above will be called and click yes
    } else {
      console.log(`No project called ${projectIdentifier} was found. Not archiving anythin`);
    }
  },

  /**
   * @brief Unarchives a project
   * 
   * @param {*} projectIdentifier 
   */
  unarchiveProject: async function(projectIdentifier) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/admin/projects`);

    let selectStatus = await page.$('select#status');
    await selectStatus.selectOption({label: 'all'});

    const hrefPrefix = getHrefPrefix(this.redmineUrl);
    let a = await page.$(`a[href="${hrefPrefix}/projects/${projectIdentifier}"]`);
    if(a) {
      // console.log(`Found project ${projectIdentifier}`);

      // Go up the DOM tree: a -> span -> td -> tr
      let span = await a.$('..');
      let td = await span.$('..');
      let tr = await td.$('..');
      let archive = await tr.$('a.icon.icon-unlock');
      await archive.click();

      // dialog response callback above will be called and click yes
    } else {
      console.log(`No project called ${projectIdentifier} was found. Not archiving anythin`);
    }

  },

  /**
   * @brief Returns the list of users
   */
  getUsers: async function() {
    const page = await this.context.newPage();
    let users = [];

    for(let pageNum=1; pageNum<1000; pageNum++) {
      await page.goto(`${this.redmineUrl}/users?page=${pageNum}`);
      table = await page.$('table.list.users');
      if(table != null) {
        tbody = await table.$('tbody');
        const rows = await tbody.$$('tr');
        for(tr of rows) {
          const tdUsername = await tr.$('td.username');
          const login = await page.evaluate(el => el.innerText, await tdUsername.$('a'));
          const tdEmail = await tr.$('td.email');
          const email = await page.evaluate(el => el.innerText, await tdEmail.$('a'));
          users.push({
            login: login,
            email: email
          });
        }
      } else {
        break;
      }
    }
    return users;
  },

  /**
   * @brief Creates a user
   * 
   * @param {*} properties User information, such as login, firstname, lastname, and email. Note that language must be an ISO 639-1 language code
   */
  createUser: async function(properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/users/new`);
  
    await fillOutNewUserForm(page, properties);
    // await page.screenshot({ path: 'new-user-form-filled-out.png' });
    await page.click('input[type="submit"][name="commit"]');
    // await page.screenshot({ path: 'new-user.png' });
  },

  /**
   * @brief Creates users
   * 
   * @param {*} properties An array of user information
   */
  createUsers: async function(properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/users/new`);

    lastUser = properties.pop();
    for(userProperties of properties) {
      await fillOutNewUserForm(page, userProperties);
      await page.click('input[type="submit"][name="continue"]');
    }

    await fillOutNewUserForm(page, lastUser);
    await page.click('input[type="submit"][name="commit"]');
  },

  /**
   * @brief Deletes a user
   * 
   * @param {*} login 
   */
  deleteUser: async function(login) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/users`);

    // Search the user by the login name
    // Note that this does not narrow down to only the specified user;
    // suppose there are three users with these login names: a, ab, and abc.
    // The user calls this function like this: deleteUser('a')
    // Then all 3 users above will be displayed.
    await page.fill('input#name', login);
    await page.click('input[type="submit"]');

    let table = await page.$('table.list.users');
    // let a = await table.$(`a[text="${login}"]`);
    let a = await table.$(`text="${login}"`);

    // Get the parent element in the DOM tree
    let td = await a.$('..');
    let tr = await td.$('..');

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const del = await tr.$('a.icon.icon-del');
    await del.click();
  },

  deleteUsersExcept: async function(usersToKeep) {
    console.error('Error: not implemented');
  },

  getIssueStatuses: async function() {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/issue_statuses`);

    const table = await page.$('table.list.issue_statuses');
    const rows = await page.$$('tr');
    // console.log(`${rows.length} issue statuses found`);
    let statuses = [];
    for(row of rows) {
      const td = await row.$('td.name');
      const name = await page.evaluate(el => el.innerText, await td.$('a'));
      const issueClosed = (await page.$('span.icon-only.icon-checked') !== null);
      status = {
        name: name,
        issueClosed: issueClosed};
      statuses.push(status);
    }
    return statuses;
  },

  createIssueStatus: async function(properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/issue_statuses/new`);

    await page.fill('input#issue_status_name', properties.name);
    if(properties.issueClosed) {
      await page.check('#issue_status_is_closed');
    } else {
      await page.uncheck('#issue_status_is_closed');
    }
    await page.click('input[type="submit"][name="commit"]');
  },

  deleteIssueStatus: async function(name) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/issue_statuses`);

    const a = await page.$(`table.list.issue_statuses >> tbody >> text="${name}"`);
    const td = await a.$('..');
    const tr = await td.$('..');

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const del = await tr.$('a.icon.icon-del');
    await del.click();
  },

  createAuthenticationMode: async function(properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/auth_sources/new`);

    // Required fields
    await page.fill('#auth_source_name', properties.name);
    await page.fill('#auth_source_host', properties.host);
    await page.fill('#auth_source_port', properties.port.toString());
    await page.fill('#auth_source_attr_login', properties.loginAttribute);

    // Base DN is marked as required but you can create an auth mode without one
    await page.fill('#auth_source_base_dn', properties.baseDn);

    if(properties.account) {
      await page.fill('#auth_source_account', properties.account);
    }
    if(properties.password) {
      await page.fill('#auth_source_account_password', properties.password);
    }
    if(properties.ldapFilter) {
      await page.fill('#auth_source_filter', properties.ldapFilter);
    }
    if(properties.timeoutInSecounds) {
      await page.fill('#auth_source_timeout', properties.timeoutInSecounds.toString());
    }
    if(properties.onTheFlyUserCreation) {
      await page.check('#auth_source_onthefly_register');
    } else {
      await page.uncheck('#auth_source_onthefly_register');
    }
    if(properties.firstnameAttribute) {
      await page.fill('#auth_source_attr_firstname', properties.firstnameAttribute);
    }
    if(properties.lastnameAttribute) {
      await page.fill('#auth_source_attr_lastname', properties.lastnameAttribute);
    }
    if(properties.emailAttribute) {
      await page.fill('#auth_source_attr_mail', properties.emailAttribute);
    }

    await page.click('input[type="submit"][name="commit"]');
  },

  deleteAuthenticationModeByName: async function(name) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/auth_sources`);
  
    const table = await page.$('table.list');

    // There is no way to directly select the td tag with an and condition
    // of the td.name css selector and text element
    // https://stackoverflow.com/questions/1520429/is-there-a-css-selector-for-elements-containing-certain-text
    // So we just need to loop through the td.name elements found in the table.
    const tds = await table.$$('td.name');
    // console.log('tds.length:',tds.length);
    for(td of tds) {
      const text = await page.evaluate(el => el.innerText, td);
      if(text == name) {
        const tr = await td.$('..');

        page.on('dialog', async (dialog) => {
          await dialog.accept();
        });

        const del = await tr.$('a.icon.icon-del');
        await del.click();
      }
    }
  },

  getNumAuthenticationModes: async function() {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/auth_sources`);

    const span = await page.$('span.pagination >> span.items');
    const text = await page.evaluate(el => el.innerText, span);
    // text is usually something like '(1-5/5)'
    const numAuthModes = text.split('/')[1].slice(0,-1);
    return parseInt(numAuthModes, 10);
  },

  addFiles: async function(projectIdentifier, files) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/files/new`);

    // await page.screenshot({ path: 'file-page.png' });

    for(file of files) {
      if(file.version != undefined) {
        let selectElement = await page.$('#version_id');
        await selectElement.selectOption({label: file.version});
      }

      fileUploadButton = await page.$('input[type="file"]');
      await fileUploadButton.setInputFiles(file.path);

      if(file.description != undefined) {
        await page.fill('input.description', file.description);
      }
    }

    // await page.screenshot({ path: 'file-selected.png' });

    await page.click('input[name="commit"][type="submit"]');

    // await page.screenshot({ path: 'commit.png' });
  },

  downloadFile: async function(projectIdentifier, fileName) {
    console.error('Error: not implemented yet');
  },

  deleteFile: async function(projectIdentifier, filename) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/files`);

    const tbody = await page.$('table.list.files >> tbody');
    const tds = await tbody.$$('td.filename');
    // console.log(tds.length,'files');
    for(td of tds) {
      const text = await page.evaluate(el => el.innerText, await td.$('a'));
      if(text == filename) {
        const tr = await td.$('..');
        // console.log('cells:',(await tr.$$('td')).length);

        page.on('dialog', async (dialog) => {
          await dialog.accept();
        });

        const del = await tr.$('a.icon-only.icon-del');
        await del.click();
        break;
      }
    }
  },

  /**
   * @brief Creates a repository. Note that currently only Git is supported for SCM
   * 
   * @param {*} projectIdentifier 
   * @param {*} properties 
   */
  createRepository: async function(projectIdentifier, properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/repositories/new?repository_scm=${properties.scm}`);

    // Commented out; this seeminly changes the SCM to Git, but Playwright fails
    // to fill the rest of the fields (identifier, path, etc.)
    // let scm = await page.$('#repository_scm');
    // await scm.selectOption(properties.scm);

    if(properties.mainRepository) {
      await page.check('#repository_is_default');
    } else {
      await page.uncheck('#repository_is_default');
    }
    if(properties.repositoryIdentifier) {
      // console.log('repo identifier:',properties.repositoryIdentifier);
      await page.fill('#repository_identifier', properties.repositoryIdentifier);
    }

    if(properties.scm === 'Git') {
      await page.fill('#repository_url', properties.pathToRepository);
    } else {
      console.error('playwright-redmine currently only supports Git.');
    }
  
    await page.click('input[name="commit"][type="submit"]');
  },

  deleteRepository: async function(projectIdentifier, repositoryIdentifier) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/settings/repositories`);

    let tbody = await page.$('table.list >> tbody');
  },

  /**
   *
   * @param {*} projectIdentifier
   * @param {*} repositoryIdentifier
   * @returns true if the specified repository exists
   */
  repositoryExists: async function(projectIdentifier, repositoryIdentifier) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/settings/repositories`);
    let a = await page.$(`table.list >> tbody >> text="${repositoryIdentifier}"`);
    return (a != null);
  },

  createVersion: async function(projectIdentifier, properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/projects/${projectIdentifier}/versions/new`);

    await page.fill('#version_name', properties.name);

    if(properties.description) {
      await page.fill('#version_desctiption', properties.description);
    }
    if(properties.wikiPage) {
      await page.fill('#version_wiki_page_title', properties.wikiPage);
    }
    if(properties.dueDate) {
      await page.fill('#version_effective_date', properties.dueDate);
    }
    if(properties.defaultVersion) {
      await page.check('#version_default_project_version');
    } else {
      await page.uncheck('#version_default_project_version');
    }

    await page.click('input[name="commit"][type="submit"]');
  },

  /**
   * @brief Updates Redmine settings
   * 
   * @param {*} properties 
   */
  updateSettings: async function(properties) {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/settings`);

    // Note that each tab has its own Save button
    const saveButtonSelector = 'input[name="commit"][type="submit"]';

    if(properties.general) {
      await page.click('a#tab-general');
      if(properties.general.applicationTitle != undefined) {
        await page.fill('#settings_app_title', properties.general.applicationTitle);
      }
      if(properties.general.welcomeText != undefined) {
        await page.fill('#settings_welcome_text', properties.general.welcomeText);
      }
      if(properties.general.searchResultsPerPage != undefined) {
        const num = properties.general.searchResultsPerPage.toString();
        await page.fill('#settings_search_results_per_page', num);
      }
      const saveButton = await page.$(`#tab-content-general >> ${saveButtonSelector}`);
      await saveButton.click();
    }

    if(properties.api) {
      await page.click('a#tab-api');
      if(properties.api.enableRestApi != undefined) {
        if(properties.api.enableRestApi) {
          await page.check('#settings_rest_api_enabled');
        } else {
          await page.uncheck('#settings_rest_api_enabled');
        }
      }
      const saveButton = await page.$(`#tab-content-api >> ${saveButtonSelector}`);
      await saveButton.click();
    }

    if(properties.files) {
      await page.click('a#tab-attachments');
      if(properties.files.maximumAttachmentSizeInKB != undefined) {
        await page.fill('#settings_attachment_max_size',
        properties.files.maximumAttachmentSizeInKB.toString());
      }
      const saveButton = await page.$(`#tab-content-attachments >> ${saveButtonSelector}`);
      await saveButton.click();
    }
  },

  /**
   * @brief Returns the list of plugins currently installed on Redmine
   * 
   * @return an array of JavaScript objects (1 element per plugin)
   */
  getPlugins: async function() {
    const page = await this.context.newPage();
    await page.goto(`${this.redmineUrl}/admin/plugins`);

    const table = await page.$('table.list.plugins');
    const rows = await page.$$('tr');
    // console.log(`${rows.length} plugins are currently installed.`);
    let plugins = [];
    for(row of rows) {
      const id = await page.evaluate(el => el.id, row);
      const basicInfoCell = await row.$('td.name');
      const name = await page.evaluate(el => el.innerText, await basicInfoCell.$('span.name'));
      const description = await page.evaluate(el => el.innerText, await basicInfoCell.$('span.description'));
      const url = await page.evaluate(el => el.innerText, await basicInfoCell.$('span.url'));
      const author = await page.evaluate(el => el.innerText, await row.$('td.author'));
      const version = await page.evaluate(el => el.innerText, await row.$('td.version'));
      plugin = {
        id: id,
        name: name,
        description: description,
        url: url,
        author: author,
        version: version};
      plugins.push(plugin);
    }
    return plugins;
  }
}
