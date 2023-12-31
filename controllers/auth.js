import User from '../models/user.js';
import jwt from 'jsonwebtoken';
import expressJwt from 'express-jwt';
import { validationResult } from 'express-validator';

export const apiAuth = (req, res, next) => {
  if(req.headers['api-key']) {  
    let apiKey = req.headers['api-key']

    if(apiKey !== process.env.API_KEY) {
      return res.status(400).json({
        message: "API Key invalide"
      })
    }
    next()
  } else {
    return res.status(400).json({
      message: "Manque API Token"
    })
  }
}

export const signup = async (req, res) => {
  const errors = validationResult(req)

  if(!errors.isEmpty()) {
    return res.status(402).json({
      error: errors.array()[0].msg
    })
  }

  const {email} = req.body
  const emailAlreadyUser = await User.findOne({ email: email })

  if(emailAlreadyUser) {
    return res.status(403).json({
      error: "Email déjà utilisé"
    })
  }

  const user = new User(req.body)
  await user.save()

  res.json({
    message: "Utilisateur ajouté avec succés",
    user: {
      name: user.name,
      email: user.email,
      id: user._id
    }
  })
}

export const signin = async (req, res) => {
  const {email, password} = req.body

  const user = await User.findOne({ email: email })

  if(!user) {
    return res.status(403).json({
      error: "Email inexistant"
    })
  }

  if(!user.authenticate(password)) {
    return res.status(401).json({
      error: "Email et mot de passe ne correspondent pas"
    })
  } else {
    const token = jwt.sign({_id: user._id}, process.env.SECRET)

    res.cookie("token", token, { expire: new Date() + 100 })

    const { _id, name, email, role } = user
    return res.json({token, user: { _id, name, email, role }})
  }
}


export const signout = (req, res) => {
  res.clearCookie("token")
  res.json({
    message: "Utilisateur déconnecté avec succés"
  })
}

export const isSignedIn = expressJwt({
  secret: process.env.SECRET,
  userProperty: "auth",
})

export const isAuthenticated = (req, res, next) => {
  let checker = req.profile && req.auth && req.profile._id == req.auth._id
  if(!checker) {
    return res.status(403).json({
      error: "ACCESS DENIED"
    })
  }

  next()
}

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']

  console.log(authHeader);

  if (authHeader == null) return res.sendStatus(401)

  jwt.verify(authHeader, process.env.SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(401)
    }
    req.user = user;
    next();
  });
};

export const isAdmin = (req, res, next) => {
  if(req.profile.role === 0) {
    return res.status(403).json({
      error: "Pas admin, Access Denied"
    })
  }

  next()
}

export const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).exec();

    if (!user) {
      return res.status(403).json({
        error: "Email inexistant"
      });
    }

    const val = Math.floor(10000 + Math.random() * 9000);

    const updatedUser = await User.findByIdAndUpdate(
      { _id: user._id },
      { $set: { verification_code: val } },
      { new: true, useFindAndModify: false }
    ).exec();

    if (!updatedUser) {
      return res.status(400).json({
        error: "Vous ne pouvez pas mettre à jour cet utilisateur"
      });
    }

    updatedUser.salt = undefined;
    updatedUser.encry_password = undefined;
    
    res.json({
      status: "Success",
      id: updatedUser._id,
      message: "Code de vérification envoyé avec succès"
    });
  } catch (err) {
    return res.status(400).json({
      error: "Une erreur s'est produite lors de l'envoi du code de vérification"
    });
  }
};


export const resetPassword = async (req, res) => {
  try {
    const { id, verificationCode, newPassword } = req.body;
    const user = await User.findById(id).exec();

    if (!user) {
      return res.status(400).json({
        error: "Utilisateur inexistant"
      });
    }

    if (verificationCode === null) {
      return res.status(400).json({
        error: "S'il vous plaît entrer un code de vérification"
      });
    }

    if (user.verification_code !== verificationCode) {
      return res.status(400).json({
        error: "Code de vérification invalide"
      });
    }

    if (!newPassword) {
      return res.status(200).json({
        message: "S'il vous plaît entrer un nouveau mot de passe"
      });
    }

    if (newPassword.length < 6) {
      return res.json({
        error: "Mot de passe doit être au moins 6 caractères"
      });
    }

    if (user.securePassword(newPassword) === user.encry_password) {
      return res.json({
        error: "S'il vous plaît entrer un mot de passe différent de l'ancien"
      });
    }

    const encryPassword = user.securePassword(newPassword);

    const updatedUser = await User.findByIdAndUpdate(
      { _id: id },
      { $set: { verification_code: undefined, encry_password: encryPassword } },
      { new: true, useFindAndModify: false }
    ).exec();

    if (!updatedUser) {
      return res.status(400).json({
        error: "Impossible de mettre à jour le mot de passe"
      });
    }

    res.json({
      status: "Success",
      id: updatedUser._id,
      message: "Mot de passe changé avec succès"
    });
  } catch (err) {
    return res.status(400).json({
      error: "Une erreur s'est produite lors de la réinitialisation du mot de passe"
    });
  }
};

