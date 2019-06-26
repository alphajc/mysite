var placeholder = document.querySelectorAll('.column.left');

placeholder.forEach(function(item,index,arr){
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
        component.append(large);
        large.onload = function () {
            small.remove();
            large.classList.add('portrait');
            large.classList.add('loaded');
        }
    }())
})