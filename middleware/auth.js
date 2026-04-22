  const jwt = require('jsonwebtoken');

  const authMiddleware = (req, res, next) => {                                                                                                
    const token = req.headers.authorization?.split(' ')[1]; // extract token from "Bearer <token>"
                                                                                                                                              
    if (!token) return res.status(401).json({ error: 'No token provided' });                                                                  
   
    try {                                                                                                                                     
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // verify + decode
      req.user = decoded; // attach user info to request — routes can access via req.user
      next(); // pass to next middleware or route handler                                                                                     
    } catch (error) {                                                                                                                         
      return res.status(401).json({ error: 'Invalid token' });                                                                                
    }                                                                                                                                         
  };                                                        

  module.exports = authMiddleware;