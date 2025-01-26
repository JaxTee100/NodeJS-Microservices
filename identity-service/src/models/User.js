const mongoose = require('mongoose');
const argon2 = require('argon2');



const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
}, {
    timestamps: true,
})
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        this.password = await argon2.hash(this.password);
        next();
    } catch (error) {
        next(error);
    }
});


UserSchema.methods.comparePassword = async function (password) {
    try {
        return await argon2.verify(this.password, password);
    } catch (error) {
        throw new Error(error);
    }
}

UserSchema.index({ username: "text" });
module.exports = mongoose.model('User', UserSchema);