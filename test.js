import test from 'tape';
import mongoose from './index';
mongoose.connect('mongodb://localhost/mongoose_fill_test');

const userSchema = new mongoose.Schema({
  _id: 'number',
  name: 'string',
  age: 'number',
  dude: {type: 'number', ref: 'User'}
})

const accountSchema = new mongoose.Schema({
  _id: 'number',
  name: 'string'
})

const petSchema = new mongoose.Schema({
  _id: 'number',
  name: 'string',
  master: {type: 'number', ref: 'User'}
})


accountSchema.fill('upper', function(add, callback){
  this.db.model('User')
  callback(null, this.name.toUpperCase() + add)
}).options('_Y')

const surnames = ['Galt', 'Dow']

const Account = mongoose.model('Account', accountSchema)
const makeAccounts = (names) => {
  return names.map(name => new Account({name: name}))
}


userSchema.fill('surname', function(callback){
  this.db.model('User')
  const val = surnames[this._id - 1]
  callback(null, val)
}).multi(function(users, ids, callback){
  const result = ids.map(function(id){
    return {_id: id, surname: surnames[id - 1]}
  })

  callback(null, result)
})

userSchema.fill('accounts').value(function(callback){
  const val = [
    makeAccounts(['fb', 'twitter']),
    makeAccounts(['google'])
  ][this._id - 1]
  callback(null, val)
}).default([])


userSchema.fill('actions mood', function(upperCase, prefix, callback){
  const mood = prefix + 'good'
  callback(null, {
    actions: ['eat', 'pray', 'kill'],
    mood: (upperCase ? mood.toUpperCase() : mood)
  })
}).options(false , 'super')

userSchema.fill('purchases', function(callback){
  callback(null, [{amount: 5}, {amount: 10}])
})

userSchema.fill('friend', function(callback){
  const val = [
    new User({_id: 2}),
    new User({_id: 1})
  ][this._id - 1]
  callback(null, val)
})

const User = mongoose.model('User', userSchema)
const Pet = mongoose.model('Pet', petSchema)

test('setup', async t => {
  const usersData = [
    {_id: 1, name: 'Alex', age: 10},
    {_id: 2, name: 'Jane', age: 12, dude: 1}
  ];

  try {
    await User.remove({});
    await User.create(usersData);
    t.end();
  } catch (err) {
    t.error(err);
  }
});

test('fill one property: purchases', async t => {
  try {
    const user = await User.findById(1).fill('purchases');
    t.ok(user.name == 'Alex', 'user name is ok');
    t.ok(!!user.purchases, 'user purchases present');
    t.ok(user.purchases[0].amount == 5, 'first purchase amount is ok');
    t.end();
  } catch (err) {
    t.error(err);
  }
});

test('fill multiple properties with select: purchases, actions', async t => {
  try {
    const user = await User.findById(1).select('name purchases actions')
    t.ok(user.name == 'Alex', 'user name is ok')
    //t.ok(user.accounts && user.accounts.length == 0, 'user accounts filled with default value')
    t.ok(!user.age, 'user age not selected')
    t.ok(user.purchases && user.purchases.length > 0, 'purchases here')
    t.ok(user.actions && user.actions.length > 0, 'actions here')
    t.ok(!user.mood, 'mood is not here')
    t.end();
  } catch (err) {
    t.error(err);
  }
})


test('fill on instance only one (exclusive) "mood" prop with lacking options', async t => {
  t.plan(2);

  try {
    let user = await User.findById(1)

    user = await user.fill('mood', true);

    t.is(user.mood, 'SUPERGOOD', 'user mood here')
    t.ok(!user.actions, 'user actions not here')
    //t.ok(user.actions && user.actions.length > 0, 'user actions here')
  } catch (err) {
    t.error(err);
  };
})

test('fill on instance: mood, actions, surname', async t => {
  try {
    let user = await User.findById(1);

    user = await user.fill('mood actions surname');
    t.is(user.mood, 'supergood', 'user mood here')
    t.ok(user.actions && user.actions.length > 0, 'user actions here')
    t.ok(user.surname == 'Galt', 'surname is here')
    t.end()
  } catch (err) {
    t.error(err);
  }
});

test('fill property using multi: surnames', async t => {
  try {
    const users = await User
      .find({name: {$exists: true}})
      //.sort('accounts')
      .limit(5)
      .fill('accounts surname')
      .fill('accounts.upper')

    t.ok(users.length == 2, 'user count ok')
    t.is(users[0].surname, surnames[users[0].id - 1], 'user1 surname ok ok')
    t.ok(users[0].accounts, 'user1 accounts filled')
    t.is(users[0].accounts.length, 2, 'user1 accounts count ok')
    t.is(users[0].accounts[0].upper, 'FB_Y', 'user1 accounts count ok')
    t.is(users[1].surname, surnames[users[1].id - 1], 'user2 surname ok ok')
    t.end();
  } catch (err) {
    t.error(err);
  }
});

test('fill friend nested', async t => {
  try {
    const users = await User
      .find({name: {$exists: true}})
      .fill('friend.accounts.upper', '_X');
    t.ok(users[0].friend, 'user1 friend filled')
    t.ok(users[0].friend.accounts, 'user1 friend.accounts filled')
    t.is(users[0].friend.accounts[0].upper, 'GOOGLE_X', 'user1 friend filled')
    t.ok(users[1].friend, 'user2 friend filled')
    t.end()
  } catch (err) {
    t.error(err);
  }
})

test('should not fill absent property', async t => {
  try {
    const users = await User
      .find({name: {$exists: true}})
      .fill('absent.accounts.upper', '_X')
    t.ok(!users[0].enemy, 'user1 enemy is empty')
    t.end()
  } catch (err) {
    t.error(err);
  }
})

test('should not fill absent property', async t => {
  try {
    const users = await User
      .find({name: {$exists: true}})
      .fill('enemy.accounts.upper', '_X')
    t.ok(!users[0].enemy, 'user1 enemy is empty')
    t.end()
  } catch (err) {
    t.error(err);
  }
})

test('should fill nested not filled property', async t => {
  try {
    const user = await User
      .findOne({name: 'Jane'})
      .populate('dude')
      .fill('dude.accounts.upper', '_X')
    t.is(user.dude.name, 'Alex', 'user.dude name is correct')
    t.is(user.dude.accounts.length, 2, 'user.dude accounts filled')
    t.end()
  } catch (err) {
    t.error(err);
  }
})

test('should fill nested on model that has no fill property', async t => {
  try {
    const pet = new Pet({master: new User({name: 'Alex', _id: 1})})
    await pet.fill('master.accounts')
    t.is(pet.master.accounts.length, 2, 'pet.master.accounts filled')
    t.end()
  } catch (err) {
    t.error(err);
  }
})


test('the end', async t => {
  t.end();
})