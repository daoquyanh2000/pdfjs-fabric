// If absolute URL from the remote server is provided, configure the CORS
// header on that server.
var url = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';
var pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    viewport = null,
    scale = 1,
    fabricObjects = [], // list các object của các trang
    listCoordinate = [], // list tọa độ đã bấm của các trang 
    listData = [] // list data tọa độ trả về,
    signData = null //thông tin để ký


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
    debugger
    viewport = page.getViewport({scale: scale});
    const canvas = document.createElement('canvas');
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
      debugger
    const typedarray = new Uint8Array(this.result);
    asyncDownloadPDF(typedarray);
    }
    fileReader.readAsArrayBuffer(file);
}
    /**
     * Asynchronously downloads PDF.
     */
function asyncDownloadPDF(typedarray){
    resetFabricObject();
    pdfjsLib.getDocument(typedarray).promise.then(function(pdfDoc_) {
      pdfDoc = pdfDoc_;
      document.getElementById('page_count').textContent = pdfDoc.numPages;

      // Initial/first page rendering
      renderPage(pageNum);
  });
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
    //add region to object
    addObjectToListData(rect);

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
        const fabricImage = new fabric.Image(image, {
          lockRotation: true,
          lockSkewingX: true,
          lockSkewingY: true,
          scaleX: 0.5,
          scaleY: 0.5
        })
        fabricObject.add(fabricImage)
        fabricObject.setActiveObject(fabricImage);
        //add region to object
        addObjectToListData(fabricImage);
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
  resetFabricObject();
}
document.getElementById('deleteSelectedObject').addEventListener('click', deleteSelectedObject);

function clearActivePage(){
  const fabricObj = fabricObjects[pageNum - 1];
  const bg = fabricObj.backgroundImage;
  if (confirm('Are you sure?')) {
    fabricObj.clear();
    fabricObj.setBackgroundImage(bg, fabricObj.renderAll.bind(fabricObj));
  }
  resetFabricObject();
}
document.getElementById('clearActivePage').addEventListener('click', clearActivePage);

function saveCoordinate(){
  let data = JSON.parse(JSON.stringify(listData))
  listData.forEach((region, index) => {
    const position = region.Object.getBoundingRect();
    //Sửa lại top bởi vì gốc tọa độ BE  và FE là khác nhau
    const fixedTop = viewport.height - position.top - position.height;
    data[index] = {
      PageNumber: region.PageNumber,
      Coordinates: {
        llx: Math.round(position.left),
        lly: Math.round(position.height + fixedTop),
        urx: Math.round(position.left + position.width),
        ury: Math.round(fixedTop),
      },
    }
  });
  signData = data[data.length - 1];
  console.log(data);
}
document.getElementById('saveCoordinate').addEventListener('click', saveCoordinate);


function signPDF(){
  saveCoordinate();
  var formdata = new FormData();
  const pdfInput = document.getElementById('file');
  const signImageInput = document.getElementById('signImage');
  formdata.append("serial", "54010b000310be42cdc04865a84242ca");
  formdata.append("file", pdfInput.files[0], "pdf file");
  formdata.append("isVisible", "true");
  formdata.append("page", signData.PageNumber);
  formdata.append("llx", signData.Coordinates.llx);
  formdata.append("lly", signData.Coordinates.lly);
  formdata.append("urx", signData.Coordinates.urx);
  formdata.append("ury", signData.Coordinates.ury);
  formdata.append("detectString", "");
  formdata.append("image", signImageInput.files[0], "sign image");
  formdata.append("detail", "1,6");
  formdata.append("reason", "");
  formdata.append("location", "");
  formdata.append("contactInfo", "");

  var requestOptions = {
    method: 'POST',
    body: formdata,
    redirect: 'follow'
  };

  fetch("http://localhost:14423/api/v1/sign/pdf/usb", requestOptions)
    .then(response => response.json())
    .then(result => {
      downloadPDF(result.data)
    })
    .catch(error => console.log('error', error));
}
document.getElementById('signPDF').addEventListener('click', signPDF);

function loadFile(event) {
  debugger
  var output = document.getElementById('previewImage');
  output.src = URL.createObjectURL(event.target.files[0]);
  output.onload = function() {
    URL.revokeObjectURL(output.src) // free memory
  }
};


function addObjectToListData(object){
  listData.push({
    PageNumber: pageNum,
    Object: object
  })
}
function resetFabricObject(){
  fabricObjects = [];    
  listData = [];
}
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
function base64ToUint8Array(base64) {
  var raw = atob(base64);
  var uint8Array = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) {
    uint8Array[i] = raw.charCodeAt(i);
  }
  return uint8Array;
}
function downloadPDF(pdf) {
  const linkSource = `data:application/pdf;base64,${pdf}`;
  const downloadLink = document.createElement("a");
  const fileName = "signed-pdf.pdf";
  downloadLink.href = linkSource;
  downloadLink.download = fileName;
  downloadLink.click();
  //downloadLink.remove();
}