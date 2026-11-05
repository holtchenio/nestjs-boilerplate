import prompts from 'prompts';
import removeFacebookAuth from './scripts/remove-auth-facebook.js';
import removeGoogleAuth from './scripts/remove-auth-google.js';
import removeAppleAuth from './scripts/remove-auth-apple.js';
import removeInstallScripts from './scripts/remove-install-scripts.js';
import removePostgreSql from './scripts/remove-postgresql.js';
import removeMongoDb from './scripts/remove-mongodb.js';
import removeRelationalResourceGeneration from './scripts/resource-generation-scripts/remove-relational.js';
import removeDocumentResourceGeneration from './scripts/resource-generation-scripts/remove-document.js';
import removeAllDbResourceGeneration from './scripts/resource-generation-scripts/remove-all-db.js';
import removeAllDbPropertyGeneration from './scripts/property-generation-scripts/remove-all-db.js';
import removeDocumentPropertyGeneration from './scripts/property-generation-scripts/remove-document.js';
import removeRelationalPropertyGeneration from './scripts/property-generation-scripts/remove-relational.js';

void (async () => {
  const response = await prompts(
    [
      {
        type: 'select',
        name: 'database',
        message: 'Which database do you want to use?',
        choices: [
          { title: 'PostgreSQL and MongoDB', value: 'pg-mongo' },
          { title: 'PostgreSQL', value: 'pg' },
          { title: 'MongoDB', value: 'mongo' },
        ],
      },
      {
        type: 'confirm',
        name: 'isAuthFacebook',
        message: 'Include Facebook auth?',
        initial: true,
      },
      {
        type: 'confirm',
        name: 'isAuthGoogle',
        message: 'Include Google auth?',
        initial: true,
      },
      {
        type: 'confirm',
        name: 'isAuthApple',
        message: 'Include Apple auth?',
        initial: true,
      },
    ],
    {
      onCancel() {
        process.exit(1);
      },
    },
  );

  if (response.database === 'pg-mongo') {
    removeRelationalResourceGeneration();
    removeDocumentResourceGeneration();
    removeDocumentPropertyGeneration();
    removeRelationalPropertyGeneration();
  }

  if (response.database === 'mongo') {
    removePostgreSql();
    removeRelationalResourceGeneration();
    removeRelationalPropertyGeneration();
    removeAllDbResourceGeneration();
    removeAllDbPropertyGeneration();
  }

  if (response.database === 'pg') {
    removeMongoDb();
    removeDocumentResourceGeneration();
    removeDocumentPropertyGeneration();
    removeAllDbResourceGeneration();
    removeAllDbPropertyGeneration();
  }

  if (!response.isAuthFacebook) {
    removeFacebookAuth();
  }

  if (!response.isAuthGoogle) {
    removeGoogleAuth();
  }

  if (!response.isAuthApple) {
    removeAppleAuth();
  }

  removeInstallScripts();
  process.exit(0);
})();
