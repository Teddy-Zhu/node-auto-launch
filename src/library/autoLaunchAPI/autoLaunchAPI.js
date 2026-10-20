export default class AutoLaunchAPI {
  constructor(init) {
    this.appName = init.appName;
    this.appPath = init.appPath;
    this.options = init.options;
  }

  get launchArguments() {
    const { launchInBackground, extraArguments } = this.options;
    return launchInBackground
      ? [launchInBackground === true ? '--hidden' : launchInBackground, ...extraArguments]
      : [...extraArguments];
  }

  enable() {
    throw new Error('enable() not implemented');
  }

  disable() {
    throw new Error('disable() not implemented');
  }

  isEnabled() {
    throw new Error('isEnabled() not implemented');
  }
}
