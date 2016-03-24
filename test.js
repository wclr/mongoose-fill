'use strict'

var test = require('tape');
var mongoose = require('./index')
mongoose.connect('mongodb://localhost/mongoose_fill_test')

var userSchema = new mongoose.Schema({
  _id: 'number',
  name: 'string'
})


var accountSchema = new mongoose.Schema({
  _id: 'number',
  name: 'string'
})

accountSchema.fill('upper', function(add, callback){
  callback(null, this.name.toUpperCase() + add)
}).options('_Y')

userSchema.set('toJSON', {
  getters: true,
  virtuals: true
})

userSchema.set('toObject', {
  virtuals: true
})

var surnames = ['Galt', 'Dow']

var Account = mongoose.model('Account', accountSchema)
var makeAccounts = (names) => {
  return names.map(name => new Account({name: name}))
}

userSchema.fill('surname', function(callback){
  var val = surnames[this._id - 1]
  callback(null, val)
}).multi(function(users, ids, callback){

  //var result = ids.map(function(id){
  //    return surnames[id - 1]
  //})

  var result = ids.map(function(id){
    return {_id: id, surname: surnames[id - 1]}
  })

  callback(null, result)
})

userSchema.fill('accounts').value(function(callback){
  var val = [
    makeAccounts(['fb', 'twitter']),
    makeAccounts(['google'])
  ][this._id - 1]
  callback(null, val)
}).default([])


userSchema.fill('actions mood', function(upperCase, prefix, callback){
  //console.log('actions mood', arg1, arg2, callback)
  var mood = prefix + 'good'
  callback(null, {
    actions: ['eat', 'pray', 'kill'],
    mood: (upperCase ? mood.toUpperCase() : mood)
  })
}).options(false , 'super')

userSchema.fill('purchases', function(callback){
  callback(null, [{amount: 5}, {amount: 10}])
})

userSchema.fill('friend', function(callback){
  var val = [
    new User({_id: 2}),
    new User({_id: 1})
  ][this._id - 1]
  callback(null, val)
})


mongoose.model('User', userSchema)

// TODO: for ref schema tests
var purchaseSchema = new mongoose.Schema({
  amount: 'string'
})

var User = mongoose.model('User', userSchema)

test('setup', function (t) {
  t.plan(1)

  var usersData = [
    {_id: 1, name: 'Alex', age: 10},
    {_id: 2, name: 'Jane', age: 12}
  ]

  User.remove({}, function(){
    User.create(usersData, t.error)
  })

});


test('fill one property: purchases', function (t) {
  t.plan(3)

  User.findById(1).fill('purchases').then(function(user){
    t.ok(user.name == 'Alex', 'user name is ok')
    t.ok(!!user.purchases, 'user purchases present')
    t.ok(user.purchases[0].amount == 5, 'first purchase amount is ok')
  }, t.error)
})

test('fill multiple properties with select: purchases, actions', function (t) {
  User.findById(1).select('name purchases actions')
    .then(function(user){
      t.ok(user.name == 'Alex', 'user name is ok')
      //t.ok(user.accounts && user.accounts.length == 0, 'user accounts filled with default value')
      t.ok(!user.age, 'user age not selected')
      t.ok(user.purchases && user.purchases.length > 0, 'purchases here')
      t.ok(user.actions && user.actions.length > 0, 'actions here')
      t.ok(!user.mood, 'mood is not here')
      t.end()
    }, t.error)
})


test('fill on instance only one (exclusive) "mood" prop with lacking options', function (t) {
  t.plan(2)

  User.findById(1).then(function(user){

    user.fill('mood', true, function(){
      t.is(user.mood, 'SUPERGOOD', 'user mood here')
      t.ok(!user.actions, 'user actions not here')
      //t.ok(user.actions && user.actions.length > 0, 'user actions here')
    })

  }, t.error)
})

test('fill on instance: mood, actions, surname', function (t) {

  User.findById(1).then(function(user){

    user.fill('mood actions surname', function(){
      t.is(user.mood, 'supergood', 'user mood here')
      t.ok(user.actions && user.actions.length > 0, 'user actions here')
      t.ok(user.surname == 'Galt', 'surname is here')
      t.end()
    })
  }, t.error)
})

test('fill property using multi: surnames', function (t) {
  User
    .find({name: {$exists: true}})
    //.sort('accounts')
    .limit(5)
    .fill('accounts surname')
    .fill('accounts.upper')
    .then(function(users){
      t.ok(users.length == 2, 'user count ok')
      t.is(users[0].surname, surnames[users[0].id - 1], 'user1 surname ok ok')
      t.ok(users[0].accounts, 'user1 accounts filled')
      t.is(users[0].accounts.length, 2, 'user1 accounts count ok')
      t.is(users[0].accounts[0].upper, 'FB_Y', 'user1 accounts count ok')
      t.is(users[1].surname, surnames[users[1].id - 1], 'user2 surname ok ok')
    t.end()

  }, t.error)
})

test('fill friend nested', function (t) {
  User
    .find({name: {$exists: true}})
    .fill('friend.accounts.upper', '_X')
    .then(function(users){
      t.ok(users[0].friend, 'user1 friend filled')
      t.ok(users[0].friend.accounts, 'user1 friend.accounts filled')
      t.is(users[0].friend.accounts[0].upper, 'GOOGLE_X', 'user1 friend filled')
      t.ok(users[1].friend, 'user2 friend filled')
      t.end()

    }, t.error)
})

test('should not fill absent property', function (t) {
  User
    .find({name: {$exists: true}})
    .fill('enemy.accounts.upper', '_X')
    .then(function(users){
      t.ok(!users[0].enemy, 'user1 enemy is empty')
      t.end()

    }, t.error)
})

test('the end', function (t) {
  t.end()
})