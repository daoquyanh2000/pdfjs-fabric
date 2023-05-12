// If absolute URL from the remote server is provided, configure the CORS
// header on that server.
var url = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';
var pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1,
    fabricObjects = [], // list các object của các trang
    listCoordinate = [], // list tọa độ đã bấm của các trang 
    listData = [] // list data tọa độ trả về


const imageUrl = 'image.jpg';
const containerCanvas = document.getElementById('canvas-container');
const fabricOptions = {
  color: 'rgba(0,0,0,0.2)',
  borderColor: '#000000',
  borderSize: 0,
  fontSize: 16,
};
/**
 * Get page info from document, resize canvas accordingly, and render page.
 * @param num Page number.
 */
function renderPage(num) {
  removeOldPage();
  pageRendering = true;
  // Using promise to fetch the page
  pdfDoc.getPage(num).then(function(page) {
    const viewport = page.getViewport({scale: scale});
    var canvas = document.createElement('canvas');
    containerCanvas.appendChild(canvas);
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const context = canvas.getContext('2d');

    // Render PDF page into canvas context
    var renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    var renderTask = page.render(renderContext);

    // Wait for rendering to finish
    renderTask.promise.then(function() {
      pageRendering = false;
      initFabric();
      if (pageNumPending !== null) {
        // New page rendering is pending
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
  });

  // Update page counters
  document.getElementById('page_num').textContent = num;
}

/**
 * If another page rendering in progress, waits until the rendering is
 * finised. Otherwise, executes rendering immediately.
 */
function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

/**
 * Displays previous page.
 */
function onPrevPage() {
  if (pageNum <= 1) {
    return;
  }
  pageNum--;
  queueRenderPage(pageNum);
}
document.getElementById('prev').addEventListener('click', onPrevPage);

/**
 * Displays next page.
 */
function onNextPage() {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  queueRenderPage(pageNum);
}
document.getElementById('next').addEventListener('click', onNextPage);


/**
 * Upload PDF.
 */
document.getElementById('file').onchange = function (event) {
    pageNum = 1;
    var file = event.target.files[0];
    var fileReader = new FileReader();
    fileReader.onload = function() {
    const typedarray = new Uint8Array(this.result);

    /**
     * Asynchronously downloads PDF.
     */
    pdfjsLib.getDocument(typedarray).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('page_count').textContent = pdfDoc.numPages;
    
        // Initial/first page rendering
        renderPage(pageNum);
    });
    }
    fileReader.readAsArrayBuffer(file);
}
// init region 
function initFabric(){
  let canvas = containerCanvas.querySelector("canvas");
    const background = canvas.toDataURL("image/png", 1);
    const fabricObj = new fabric.Canvas(canvas);
    fabricObjects.push(fabricObj);
    fabricObj.setBackgroundImage(background, fabricObj.renderAll.bind(fabricObj));
    fabricObj.on({
      'object:moving': (e) => {
        e.target.opacity = 0.5;
      },
      'object:modified': function (e) {
        e.target.opacity = 1;
      },
      'mouse:down': (event) => {
        // lưu tọa độ gần nhất đã bấm trong canvas
        const pointer = fabricObj.getPointer(event.e);
        const coordinates = {
          pageNumber: pageNum,
          x: Math.round(pointer.x),
          y: Math.round(pointer.y),
        };
        const position = listCoordinate.findIndex(
          (x) => x.pageNumber == coordinates.pageNumber
        );
        if (position == -1) {
          listCoordinate.push(coordinates);
        } else {
          listCoordinate.splice(position, 1, coordinates);
        }
      },
      // 'selection:updated': (e) => {

      // },
      // 'selection:created': (e) => {

      // },
    });
}

  //remove last page 
function removeOldPage(){
  childNodes = containerCanvas.childNodes;
  while(childNodes.length > 0)
    containerCanvas.removeChild(containerCanvas.lastChild);
}
/**
 * create rectangle fabric instance
 * @returns rect
 */
function rectangleInstance(top, left, width, height){
  const rect = new fabric.Rect({
    id: Date.now(),
    width: width,
    height: height,
    top: top,
    left: left,
    fill: fabricOptions.color,
    lockRotation: true,
    lockSkewingX: true,
    lockSkewingY: true,
  });
  rect.set({
    borderColor: 'red',
    cornerColor: 'green',
    cornerSize: 6,
    transparentCorners: false,
  });
  return rect;
}
/**
 * Add region to canvas
 */
function addRegion(data){
  const fabricObject = fabricObjects[pageNum - 1];
  if(fabricObject){
    const coordinate = listCoordinate.find(
      (x) => x.pageNumber == (data?.PageNumber ?? pageNum)
    );
    const rect = rectangleInstance(
      data?.Top || coordinate?.y - 50 || 0,
      data?.Left || coordinate?.x - 50 || 0,
      data?.Width ?? 100,
      data?.Height ?? 100
    );
    fabricObject.add(rect);
    fabricObject.setActiveObject(rect);
  }

}
document.getElementById('addRegion').addEventListener('click', addRegion);
/**
 * Add image to canvas
 */
function addImageToCanvas(){
  const fabricObject = fabricObjects[pageNum - 1];
  if (fabricObject) {
      var image = new Image();
      toDataURL(imageUrl, function (dataUrl) {
          image.src = dataUrl;
      })
      image.onload = function () {
        fabricObject.add(new fabric.Image(image, {
            lockRotation: true,
            lockSkewingX: true,
            lockSkewingY: true,
            scaleX: 0.5,
            scaleY: 0.5
          }))
      }
  }
}
document.getElementById('addImage').addEventListener('click', addImageToCanvas);

function deleteSelectedObject(){
  const activeObject = fabricObjects[pageNum - 1].getActiveObject();
  if (activeObject) {
    if (confirm('Are you sure ?')) {
      fabricObjects[pageNum - 1].remove(activeObject)
    }
  }
}
document.getElementById('deleteSelectedObject').addEventListener('click', deleteSelectedObject);

function clearActivePage(){
  const fabricObj = fabricObjects[pageNum - 1];
  const bg = fabricObj.backgroundImage;
  if (confirm('Are you sure?')) {
    fabricObj.clear();
    fabricObj.setBackgroundImage(bg, fabricObj.renderAll.bind(fabricObj));
  }
}
document.getElementById('clearActivePage').addEventListener('click', clearActivePage);

function saveCoordinate(){
  console.log(listCoordinate);
}
document.getElementById('saveCoordinate').addEventListener('click', saveCoordinate);


function toDataURL(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
      var reader = new FileReader();
      reader.onloadend = function () {
          callback(reader.result);
      }
      reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
}