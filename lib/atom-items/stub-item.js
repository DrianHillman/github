import {Emitter, CompositeDisposable} from 'event-kit';

export default class StubItem {
  static stubsBySelector = new Map()

  // StubItems should only be created by `create` and never constructed directly.
  static create(selector, props) {
    const stub = new StubItem(selector, props);
    const override = {
      _getStub: () => stub,
      getElement: () => stub.getElement(),
      destroy: stub.destroy.bind(stub),
    };
    const proxy = new Proxy(override, {
      get(target, name) {
        const item = stub.getRealItem();
        if (Reflect.has(target, name)) {
          return target[name];
        } else if (item && Reflect.has(item, name)) {
          let val = item[name];
          if (typeof val === 'function') {
            val = val.bind(item);
          }
          return val;
        } else {
          let val = stub[name];
          if (typeof val === 'function') {
            val = val.bind(stub);
          }
          return val;
        }
      },
    });
    this.stubsBySelector.set(selector, proxy);
    return proxy;
  }

  static getBySelector(selector) {
    return this.stubsBySelector.get(selector);
  }

  static getElementBySelector(selector) {
    const stub = this.getBySelector(selector);
    if (stub) {
      return stub.getElement();
    } else {
      return null;
    }
  }

  constructor(selector, props = {}) {
    this.emitter = new Emitter();
    this.subscriptions = new CompositeDisposable();

    this.selector = selector;
    this.props = props;
    this.element = document.createElement('div');
    this.element.classList.add(`github-StubItem-${selector}`);
    this.realItem = null;
  }

  setRealItem(item) {
    this.realItem = item;
    this.emitter.emit('did-change-title');
    this.emitter.emit('did-change-icon');

    if (item.onDidChangeTitle) {
      this.subscriptions.add(item.onDidChangeTitle((...args) => this.emitter.emit('did-change-title', ...args)));
    }

    if (item.onDidChangeIcon) {
      this.subscriptions.add(item.onDidChangeIcon((...args) => this.emitter.emit('did-change-icon', ...args)));
    }

    if (item.onDidDestroy) {
      this.subscriptions.add(item.onDidDestroy((...args) => {
        this.realItem = null;
        this.emitter.emit('did-destroy', ...args);
      }));
    }
  }

  getRealItem() {
    return this.realItem;
  }

  getTitle() {
    return this.props.title || null;
  }

  getIconName() {
    return this.props.iconName || null;
  }

  onDidChangeTitle(cb) {
    return this.emitter.on('did-change-title', cb);
  }

  onDidChangeIcon(cb) {
    return this.emitter.on('did-change-icon', cb);
  }

  getElement() {
    return this.element;
  }

  onDidDestroy(cb) {
    return this.emitter.on('did-destroy', cb);
  }

  destroy() {
    this.subscriptions.dispose();
    this.emitter.dispose();
    StubItem.stubsBySelector.delete(this.selector);
    if (this.actualItem) {
      this.actualItem.destroy && this.actualItem.destroy();
    }
  }
}
