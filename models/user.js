import mongoose from 'mongoose';
import crypto from 'crypto';
import uuidv1 from 'uuid/v1.js';

const { ObjectId } = mongoose.Schema;

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
      maxlength: 32,
      trim: true,
    },
    lastname: {
      type: String,
      required: true,
      maxlength: 32,
      trim: true,
    },
    aboutme: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      maxlength: 32,
      trim: true,
    },
    verification_code: {
      type: Number,
      default: null,
    },
    encry_password: {
      type: String,
      required: true,
    },
    salt: String,
    role: {
      type: Number,
      default: 0,
    },
    apiKey: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

userSchema
  .virtual('password')
  .set(function (password) {
    this._password = password;
    this.salt = uuidv1();
    this.encry_password = this.securePassword(password);
  })
  .get(function () {
    return this._password;
  });

userSchema.methods = {
  authenticate: function (plainpassword) {
    return this.securePassword(plainpassword) === this.encry_password;
  },

  securePassword: function (plainpassword) {
    if (!plainpassword) return '';
    try {
      return crypto
        .createHmac('sha256', this.salt)
        .update(plainpassword)
        .digest('hex');
    } catch (err) {
      return '';
    }
  },

  generateApiKey: function () {
    return uuidv1();
  },
};

// Avant de sauvegarder un nouvel utilisateur, générez une clé API
userSchema.pre('save', function (next) {
  if (!this.apiKey) {
    this.apiKey = this.generateApiKey();
  }
  next();
});

export default mongoose.model('User', userSchema);
