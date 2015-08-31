var test = require('tape');

var mongoose = require('./index')

mongoose.connect('mongodb://localhost/mongoose_fill_test')


var userSchema = new mongoose.Schema({
    _id: 'number',
    name: 'string'
})

userSchema.set('toJSON', {
    getters: true,
    virtuals: true
})

userSchema.set('toObject', {
    virtuals: true
})

userSchema.fill('surname', function(callback){
    var val = ['Galt', 'Dow'][this._id - 1]
    callback(null, val)
})

userSchema.fill('accounts').query(function(query, callback){

    console.log('accounts fill query', query)

    var val = [['fb', 'twitter'], ['google']][this._id - 1]
    callback(null, val)
})


userSchema.fill('actions mood', function(callback){
    callback(null, {
        actions: ['eat', 'pray', 'kill'],
        mood: 'good'
    })
})

userSchema.fill('purchases', function(callback){
    callback(null, [{amount: 5}, {amount: 10}])
})

mongoose.model('User', userSchema)


var purchaseSchema = new mongoose.Schema({
    amount: 'string'
})

var User = mongoose.model('User', userSchema)

test('remove users', function (t) {
    t.plan(1)
    User.remove({}, t.error)
});

test('create users', function (t) {

    t.plan(1)

    var usersData = [
        {_id: 1, name: 'Alex', age: 10},
        {_id: 2, name: 'Jane', age: 12}
    ]

    User.create(usersData, t.error)
});


test('User Model fill purchases', function (t) {
    t.plan(3)

    User.findById(1).fill('purchases').then(function(user){
        t.ok(user.name == 'Alex', 'user name is ok')
        t.ok(!!user.purchases, 'user purchases present')
        t.ok(user.purchases[0].amount == 5, 'first purchase amount is ok')
    }, t.error)
})

test.only('User Model fill purchases and actions using select', function (t) {


    User.findById(1).select('name purchases actions').then(function(user){
        t.ok(user.name == 'Alex', 'user name is ok')
        t.ok(user.purchases && user.purchases.length > 0, 'purchases here')
        t.ok(user.actions && user.actions.length > 0, 'actions here')
        t.ok(!user.mood, 'mood is not here')
        t.end()
    }, t.error)
})


test('User instance fill only mood', function (t) {
    t.plan(2)

    User.findById(1).then(function(user){

        user.fill('mood', function(){
            t.ok(user.mood == 'good', 'user mood here')
            t.ok(!user.actions, 'user actions not here')
            //t.ok(user.actions && user.actions.length > 0, 'user actions here')
        })

    }, t.error)
})

test('User instance fill mood and actions and surname', function (t) {


    User.findById(1).then(function(user){

        user.fill('mood actions surname', function(){
            t.ok(user.mood == 'good', 'user mood here')
            t.ok(user.actions && user.actions.length > 0, 'user actions here')
            t.ok(user.surname == 'Galt', 'surname is here')
            t.end()
        })
    }, t.error)
})

test.skip('User model fill query accounts', function (t) {


    User
        .find({name: {$exists: true}})
        .sort('accounts')
        .limit(5)
        .fill('accounts').then(function(users){

            t.ok(users.length > 2, 'user count ok')
            //t.ok(user.actions && user.actions.length > 0, 'user actions here')
            //t.ok(user.surname == 'Galt', 'surname is here')
            t.end()

    }, t.error)
})