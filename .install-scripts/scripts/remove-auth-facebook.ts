import replace from '../helpers/replace.js';
import path from 'path';
import fs from 'fs';

const removeFacebookAuth = () => {
  replace({
    path: path.join(process.cwd(), 'src', 'app.module.ts'),
    actions: [
      {
        find: /\s*AuthFacebookModule\,.*/g,
        replace: '',
      },
      {
        find: /\s*facebookConfig\,.*/g,
        replace: '',
      },
      {
        find: /\s*import \{ AuthFacebookModule \} from '\.\/auth\-facebook\/auth\-facebook\.module\.js'\;.*/g,
        replace: '',
      },
      {
        find: /\s*import facebookConfig from '\.\/auth\-facebook\/config\/facebook\.config\.js'\;.*/g,
        replace: '',
      },
    ],
  });

  replace({
    path: path.join(process.cwd(), 'package.json'),
    actions: [
      {
        find: /\s*\"fb\":.*/g,
        replace: '',
      },
      {
        find: /\s*\"@types\/facebook\-js\-sdk\":.*/g,
        replace: '',
      },
    ],
  });
  replace({
    path: path.join(process.cwd(), 'src', 'config', 'config.type.ts'),
    actions: [
      {
        find: /\s*facebook\: FacebookConfig.*/g,
        replace: '',
      },
      {
        find: /\s*import \{ FacebookConfig \}.*/g,
        replace: '',
      },
    ],
  });
  fs.rmSync(path.join(process.cwd(), 'src', 'auth-facebook'), {
    recursive: true,
    force: true,
  });
};

export default removeFacebookAuth;
