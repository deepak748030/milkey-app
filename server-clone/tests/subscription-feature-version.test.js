const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('new users are versioned but old users remain grandfathered on profile updates', async () => {
    const hooks = {};
    class Schema {
        static Types = { ObjectId: class ObjectId {} };
        pre(name, fn) { hooks[name] = fn; }
        post() {}
        index() {}
        virtual() { return { get() {} }; }
    }
    const mongoose = { Schema, model: () => ({}) };
    vm.runInNewContext(fs.readFileSync(require.resolve('../models/User'), 'utf8'), { require: () => mongoose, module: { exports: {} }, Date, Math, String });
    const validate = user => new Promise((resolve, reject) => hooks.validate.call(user, error => error ? reject(error) : resolve()));
    const newUser = { isNew: true };
    const oldUser = { isNew: false };
    await validate(newUser); await validate(oldUser);
    assert.equal(newUser.subscriptionFeatureVersion, 1);
    assert.equal(oldUser.subscriptionFeatureVersion, undefined);
});
