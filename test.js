var test = require('tape');

var mongoose = require('./index')

mongoose.connect('mongodb://localhost/mongoose_fill_test')


var userSchema = new mongoose.Schema({
    _id: 'number',
    name: 'string'
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
        {_id: 1, name: 'Alex'},
        {_id: 2, name: 'Jane'}
    ]

    User.create(usersData, t.error)

});


test('User.fill purchases', function (t) {
    t.plan(3)

    User.findById(1).fill('purchases').then(function(user){
        t.ok(user.name == 'Alex', 'user name is ok')
        t.ok(!!user.purchases, 'user purchases present')
        t.ok(user.purchases[0].amount == 5, 'user purchase amount is ok')
    }, t.error)
})