const profileimg = document.querySelector(".profile-img");
const input = document.querySelector("#uploadProfileImage");
const parent = document.querySelector(".profile-section");
// Update Profile

input.addEventListener("change",(e)=>{
    console.log(e);
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
        profileimg.src = reader.result;
        };
        reader.readAsDataURL(file);
})
parent.addEventListener("click",()=>{
    input.click();
})