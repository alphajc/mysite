let placeholder = document.querySelectorAll('.placeholder');

placeholder.forEach(function(item){
    (function(){
        var component = item,img = new Image(),
        small = component.querySelector('.small-img');
        img.src = small.src;
        img.onload = function(){
            small.classList.add('loaded');
        }

        //load large
        var large = new Image();
        large.src = component.dataset.large;
        large.classList.add('portrait');
        component.append(large);
        large.onload = function () {
            small.remove();
            large.classList.add('loaded');
        }
    }())
})