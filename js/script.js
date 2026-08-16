(function(){

"use strict";


/* =========================================================
   SUPABASE
========================================================= */

function getSupabase(){

if(window.aprilsSupabase){
return window.aprilsSupabase;
}

if(window.AprilsSupabase){
return window.AprilsSupabase;
}

return null;

}


function waitForSupabase(){

return new Promise(function(resolve){

const existing =
getSupabase();

if(existing){

resolve(existing);

return;

}

let attempts=0;

const timer =
setInterval(function(){

attempts++;

const client =
getSupabase();

if(client){

clearInterval(timer);

resolve(client);

return;

}

if(attempts>=100){

clearInterval(timer);

resolve(null);

}

},100);

});

}


/* =========================================================
   MOBILE MENU
========================================================= */

function setupMobileMenu(){

const button =
document.querySelector(
".menu-toggle"
);

const navigation =
document.querySelector(
".main-navigation"
);

if(!button || !navigation){
return;
}

button.addEventListener(
"click",
function(){

const open =
button.getAttribute(
"aria-expanded"
)==="true";

button.setAttribute(
"aria-expanded",
String(!open)
);

navigation.classList.toggle(
"open"
);

}
);


navigation
.querySelectorAll("a")
.forEach(function(link){

link.addEventListener(
"click",
function(){

button.setAttribute(
"aria-expanded",
"false"
);

navigation.classList.remove(
"open"
);

}
);

});

}


/* =========================================================
   COPYRIGHT
========================================================= */

function setupCopyright(){

const element =
document.getElementById(
"copyrightYear"
);

if(element){

element.textContent =
new Date().getFullYear();

}

}


/* =========================================================
   GOOGLE REVIEW
========================================================= */

function setupGoogleReview(){

document
.querySelectorAll(
'[data-google-review]'
)
.forEach(function(link){

link.href =
"https://g.page/r/CcD7hxB7NK7pEAE/review";

link.target="_blank";

link.rel=
"noopener noreferrer";

});

}


/* =========================================================
   TRAINING REGISTRATION
========================================================= */

function setupTrainingForm(){

const form =
document.getElementById(
"trainingForm"
);

if(!form){
return;
}


const button =
document.getElementById(
"trainingSubmitButton"
);

const message =
document.getElementById(
"trainingFormMessage"
);


function show(text,success){

if(!message){
return;
}

message.textContent=text;

message.style.display="block";

message.style.background=
success
?
"#e8f7ee"
:
"#fff0f0";

message.style.color=
success
?
"#145c31"
:
"#8a0018";

}


form.addEventListener(
"submit",
async function(event){

event.preventDefault();


if(button){

button.disabled=true;

button.textContent=
"Submitting...";

}


try{

const supabase =
await waitForSupabase();

if(!supabase){

throw new Error(
"Supabase unavailable."
);

}


const data =
new FormData(form);


const payload={

full_name:
String(
data.get("fullName")||""
).trim(),

phone:
String(
data.get("phone")||""
).trim(),

whatsapp:
String(
data.get("whatsapp")||""
).trim(),

location:
String(
data.get("location")||""
).trim(),

course:
String(
data.get("course")||""
).trim(),

email:
String(
data.get("email")||""
).trim(),

message:
String(
data.get("message")||""
).trim()

};


const result =
await supabase
.from(
"training_registrations"
)
.insert(payload);


if(result.error){

console.error(
"TRAINING ERROR:",
result.error
);

throw result.error;

}


show(
"Your training registration has been submitted successfully. Aprils Signature will contact you.",
true
);

form.reset();


}catch(error){

console.error(
"TRAINING SUBMISSION ERROR:",
error
);

show(
"Your registration could not be submitted right now. Please contact Aprils Signature directly.",
false
);

}finally{

if(button){

button.disabled=false;

button.textContent=
"Submit Training Registration";

}

}

});

}


/* =========================================================
   ENQUIRY FORM
========================================================= */

function setupEnquiryForm(){

const form =
document.getElementById(
"enquiryForm"
);

if(!form){
return;
}


form.addEventListener(
"submit",
async function(event){

event.preventDefault();


const button =
form.querySelector(
'button[type="submit"]'
);


const message =
document.getElementById(
"enquiryFormMessage"
);


if(button){

button.disabled=true;

button.textContent=
"Sending...";

}


try{

const supabase =
await waitForSupabase();

if(!supabase){

throw new Error(
"Supabase unavailable."
);

}


const data =
new FormData(form);


const payload={

full_name:
String(
data.get("fullName")||""
).trim(),

phone:
String(
data.get("phone")||""
).trim(),

whatsapp:
String(
data.get("whatsapp")||""
).trim(),

email:
String(
data.get("email")||""
).trim(),

subject:
String(
data.get("subject")||""
).trim(),

message:
String(
data.get("message")||
data.get("enquiry")||
""
).trim()

};


const result =
await supabase
.from("enquiries")
.insert(payload);


if(result.error){

throw result.error;

}


if(message){

message.textContent=
"Your enquiry has been submitted successfully.";

message.style.display="block";

message.style.background="#e8f7ee";

message.style.color="#145c31";

}


form.reset();


}catch(error){

console.error(error);

if(message){

message.textContent=
"Your enquiry could not be submitted. Please contact Aprils Signature directly.";

message.style.display="block";

message.style.background="#fff0f0";

message.style.color="#8a0018";

}

}finally{

if(button){

button.disabled=false;

button.textContent="Submit";

}

}

});

}


/* =========================================================
   START
========================================================= */

function start(){

setupMobileMenu();

setupCopyright();

setupGoogleReview();

setupTrainingForm();

setupEnquiryForm();

}


if(
document.readyState==="loading"
){

document.addEventListener(
"DOMContentLoaded",
start
);

}else{

start();

}

})();
