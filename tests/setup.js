// Global chrome API mock for all tests
const storageMock = {};

global.chrome = {
  runtime: {
    id: 'test-extension-id',
    lastError: null,
    sendMessage: jest.fn((msg, cb) => { if (cb) cb({}); }),
  },
  storage: {
    local: {
      get: jest.fn((keys, cb) => {
        if (typeof keys === 'string') {
          cb({ [keys]: storageMock[keys] });
        } else if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(k => { result[k] = storageMock[k]; });
          cb(result);
        } else {
          cb(storageMock);
        }
      }),
      set: jest.fn((obj, cb) => {
        Object.assign(storageMock, obj);
        if (cb) cb();
      }),
    },
    onChanged: { addListener: jest.fn() },
  },
};

// Helper to seed storage for tests
global.__setStorage = (key, value) => { storageMock[key] = value; };
global.__clearStorage = () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); };
