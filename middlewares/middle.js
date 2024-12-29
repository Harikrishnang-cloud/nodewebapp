
const preventToLogin = (req, res, next) => {
    try {
      if (req.session.user) {
        return res.redirect('/');
      }
      else{
        next(); 
      }
      
    } catch (error) {
      console.error('Error in preventToLogin middleware:', error);
      res.status(500).send('Server Error');
    }
  };
//   const checklogin = (req, res, next) => {
//     try {
//       if (req.session.user) {
//         return res.redirect('/');
//       }
//       else{
//         next(); 
//       }
       
//     } catch (error) {
//       console.error('Error in preventToLogin middleware:', error);
//       res.status(500).send('Server Error');
//     }
//   };
  
module.exports = {
    preventToLogin
}