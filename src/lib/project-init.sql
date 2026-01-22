CREATE TABLE IF NOT EXISTS `tblCanalesVenta` (
  `IdCanalVenta` int NOT NULL AUTO_INCREMENT,
  `CanalVenta` varchar(255) DEFAULT NULL,
  `Comision` decimal(10,2) DEFAULT 0,
  `Orden` int DEFAULT 0,
  `Status` int DEFAULT 0,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdCanalVenta`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblCategorias` (
  `IdCategoria` int NOT NULL AUTO_INCREMENT,
  `Categoria` varchar(145) DEFAULT NULL,
  `Status` int DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdCategoria`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblCompras` (
  `IdCompra` int NOT NULL AUTO_INCREMENT,
  `ConceptoCompra` varchar(3000) DEFAULT NULL,
  `FechaCompra` datetime DEFAULT NULL,
  `IdProveedor` int DEFAULT '0',
  `NumeroFactura` varchar(45) DEFAULT NULL,
  `Status` int DEFAULT '0',
  `FechaAct` datetime DEFAULT NULL,
  `Subtotal` double DEFAULT NULL,
  `Iva` double DEFAULT NULL,
  `Total` double DEFAULT NULL,
  `IdFormaPago` int DEFAULT '0',
  `Referencia` varchar(45) DEFAULT NULL,
  `PagarA` varchar(245) DEFAULT NULL,
  `FormaPago` varchar(45) DEFAULT NULL,
  `IdComputadora` int DEFAULT NULL,
  `IdSucursal` int  NOT NULL DEFAULT '0',
  PRIMARY KEY (`IdCompra`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblConceptosGastos` (
  `IdConceptoGasto` int NOT NULL AUTO_INCREMENT,
  `ConceptoGasto` varchar(145) DEFAULT NULL,
  `Status` int DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdConceptoGasto`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblConfiguracionesInventario` (
  `Mes` int NOT NULL,
  `IdInventario` int NOT NULL,
  `FechaInventario` datetime DEFAULT NULL,
  `InventarioCapturado` int DEFAULT NULL,
  `IdSucursal` int  NOT NULL DEFAULT '0',
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`Mes`,`IdInventario`,`IdSucursal`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblConfiguracionesMeses` (
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `FechaInventario1` datetime DEFAULT NULL,
  `FechaInventario2` datetime DEFAULT NULL,
  `FechaInventario3` datetime DEFAULT NULL,
  `FechaInventario4` datetime DEFAULT NULL,
  `FechaInventario5` datetime DEFAULT NULL,
  `ProyeccionVentas` double DEFAULT NULL,
  `IdSucursal` int NOT NULL,
  PRIMARY KEY (`Mes`,`Anio`,`IdSucursal`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin;


CREATE TABLE IF NOT EXISTS `tblDetalleCompras` (
  `IdDetalleCompra` int NOT NULL AUTO_INCREMENT,
  `IdCompra` int DEFAULT NULL,
  `IdProducto` int DEFAULT '0',
  `Producto` varchar(245) DEFAULT NULL,
  `Cantidad` double DEFAULT '1',
  `Precio` double DEFAULT NULL,
  `Iva` double DEFAULT NULL,
  `Total` double DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `Codigo` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`IdDetalleCompra`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;


CREATE TABLE IF NOT EXISTS `tblGastos` (
  `Dia` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `IdConceptoGasto` int NOT NULL,
  `Gasto` double DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `IdSucursal` int NOT NULL,
  PRIMARY KEY (`Dia`,`Mes`,`Anio`,`IdConceptoGasto`,`IdSucursal`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin;

CREATE TABLE IF NOT EXISTS `tblInventarios` (
  `IdProducto` int NOT NULL,
  `Dia` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `FechaInventario` datetime DEFAULT NULL,
  `Cantidad` double DEFAULT NULL,
  `Precio` double DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `Consumo` double DEFAULT NULL,
  PRIMARY KEY (`IdProducto`,`Dia`,`Mes`,`Anio`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin;


CREATE TABLE IF NOT EXISTS `tblNomina` (
  `Dia` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `IdUsuario` int NOT NULL,
  `Pago` double DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `IdSucursal` int NOT NULL,
  PRIMARY KEY (`Dia`,`Mes`,`Anio`,`IdUsuario`,`IdSucursal`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin;

CREATE TABLE IF NOT EXISTS `tblPlataformas` (
  `IdPlataforma` int NOT NULL AUTO_INCREMENT,
  `Plataforma` varchar(145) DEFAULT NULL,
  `Comision` double DEFAULT NULL,
  `Orden` int DEFAULT NULL,
  `Status` int DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdPlataforma`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;


CREATE TABLE IF NOT EXISTS `tblPresentaciones` (
  `IdPresentacion` int NOT NULL AUTO_INCREMENT,
  `Presentacion` varchar(145) DEFAULT NULL,
  `Status` int DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdPresentacion`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblProductos` (
  `IdProducto` int NOT NULL AUTO_INCREMENT,
  `Producto` varchar(245) DEFAULT NULL,
  `Codigo` varchar(45) DEFAULT NULL,
  `Precio` double DEFAULT NULL,
  `Status` int DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `IdCategoria` int DEFAULT NULL,
  `IdPresentacion` int DEFAULT NULL,
  `Iva` double DEFAULT NULL,
  PRIMARY KEY (`IdProducto`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblProductosKits` (
  `IdProductoPadre` int NOT NULL,
  `IdProductoHijo` int NOT NULL,
  `Cantidad` int DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdProductoPadre`,`IdProductoHijo`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblProveedores` (
  `IdProveedor` int NOT NULL AUTO_INCREMENT,
  `Proveedor` varchar(245) DEFAULT NULL,
  `RFC` varchar(45) DEFAULT NULL,
  `Calle` varchar(245) DEFAULT NULL,
  `Colonia` varchar(245) DEFAULT NULL,
  `Estado` varchar(145) DEFAULT NULL,
  `Municipio` varchar(245) DEFAULT NULL,
  `Pais` varchar(100) DEFAULT NULL,
  `Telefonos` varchar(145) DEFAULT NULL,
  `CorreoElectronico` varchar(145) DEFAULT NULL,
  `Contacto` varchar(245) DEFAULT NULL,
  `CodigoPostal` varchar(45) DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `Status` int DEFAULT '0',
  `NumExterior` varchar(100) DEFAULT NULL,
  `NumInterior` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`IdProveedor`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblPuestos` (
  `IdPuesto` int NOT NULL AUTO_INCREMENT,
  `Puesto` varchar(145) DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `Status` int DEFAULT '0',
  PRIMARY KEY (`IdPuesto`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblTerminales` (
  `IdTerminal` int NOT NULL AUTO_INCREMENT,
  `Terminal` varchar(145) DEFAULT NULL,
  `Comision` double DEFAULT NULL,
  `Status` int DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdTerminal`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblTurnos` (
  `IdTurno` int NOT NULL AUTO_INCREMENT,
  `Turno` varchar(145) DEFAULT NULL,
  `HoraInicio` varchar(10) DEFAULT NULL,
  `HoraFin` varchar(10) DEFAULT NULL,
  `Status` int DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `IdSucursal` int DEFAULT NULL,
  PRIMARY KEY (`IdTurno`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblEmpleados` (
  `IdEmpleado` int NOT NULL AUTO_INCREMENT,
  `Empleado` varchar(245) DEFAULT NULL,
  `Calle` varchar(245) DEFAULT NULL,
  `Estado` varchar(45) DEFAULT NULL,
  `Municipio` varchar(245) DEFAULT NULL,
  `Colonia` varchar(245) DEFAULT NULL,
  `CodigoPostal` varchar(45) DEFAULT NULL,
  `Telefonos` varchar(45) DEFAULT NULL,
  `CorreoElectronico` varchar(245) DEFAULT NULL,
  `IdPuesto` int DEFAULT NULL,
  `Status` int DEFAULT '0',
  `FechaAct` datetime DEFAULT NULL,
  `NumExterior` varchar(100) DEFAULT NULL,
  `NumInterior` varchar(100) DEFAULT NULL,
  `IdSucursal` int DEFAULT NULL,
  PRIMARY KEY (`IdEmpleado`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblEmpleadosDocumentos` (
  `IdEmpleadoDocumento` int NOT NULL AUTO_INCREMENT,
  `IdEmpleado` int NOT NULL,
  `Documento` varchar(255) DEFAULT NULL,
  `Comentarios` text DEFAULT NULL,
  `RutaArchivo` varchar(500) DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdEmpleadoDocumento`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblPerfilesPropinas` (
  `IdPerfilPropina` int NOT NULL AUTO_INCREMENT,
  `PerfilPropina` varchar(255) DEFAULT NULL,
  `EsActivo` int DEFAULT 1,
  `Status` int DEFAULT 0,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdPerfilPropina`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblPerfilesPropinasIngresos` (
  `IdPerfilPropina` int NOT NULL,
  `IdPuesto` int NOT NULL DEFAULT 0,
  `Porcentaje` decimal(10,2) DEFAULT 0,
  `Monto` decimal(10,2) DEFAULT 0,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdPerfilPropina`, `IdPuesto`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblPerfilesPropinasEgresos` (
  `IdPerfilPropinaEgreso` int NOT NULL AUTO_INCREMENT,
  `IdPerfilPropina` int NOT NULL,
  `Concepto` varchar(255) DEFAULT NULL,
  `Porcentaje` decimal(10,2) DEFAULT 0,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdPerfilPropinaEgreso`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblVentas` (
  `Dia` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `IdTurno` int NOT NULL,
  `IdPlataforma` int NOT NULL,
  `Venta` double DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `IdSucursal` int NOT NULL,
  PRIMARY KEY (`Dia`,`Mes`,`Anio`,`IdTurno`,`IdPlataforma`,`IdSucursal`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin;

CREATE TABLE IF NOT EXISTS `tblVentasTerminales` (
  `Dia` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `IdTurno` int NOT NULL,
  `IdTerminal` int NOT NULL,
  `Venta` double DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  `IdSucursal` int NOT NULL,
  PRIMARY KEY (`Dia`,`Mes`,`Anio`,`IdTurno`,`IdTerminal`,`IdSucursal`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin;

CREATE TABLE IF NOT EXISTS `tblVentasCanalesVenta` (
  `Dia` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `IdTurno` int NOT NULL,
  `IdCanalVenta` int NOT NULL,
  `IdSucursal` int NOT NULL,
  `Venta` double DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`Dia`,`Mes`,`Anio`,`IdTurno`,`IdCanalVenta`,`IdSucursal`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin;


CREATE TABLE IF NOT EXISTS `tblSucursales` (
  `IdSucursal` int NOT NULL AUTO_INCREMENT,
  `Sucursal` varchar(245) DEFAULT NULL,
  `Calle` varchar(245) DEFAULT NULL,
  `Estado` varchar(45) DEFAULT NULL,
  `Municipio` varchar(245) DEFAULT NULL,
  `Colonia` varchar(245) DEFAULT NULL,
  `CodigoPostal` varchar(45) DEFAULT NULL,
  `Telefonos` varchar(45) DEFAULT NULL,
  `CorreoElectronico` varchar(245) DEFAULT NULL,
  `Status` int DEFAULT '0',
  `FechaAct` datetime DEFAULT NULL,
  `NumExterior` varchar(100) DEFAULT NULL,
  `NumInterior` varchar(100) DEFAULT NULL,
  `IdEmpleadoGerente` int DEFAULT NULL,
  PRIMARY KEY (`IdSucursal`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblSucursalesInventarios` (
  `IdSucursal` int NOT NULL,
  `Dia` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `FechaInventario` datetime DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdSucursal`,`Dia`,`Mes`,`Anio`)
) ENGINE=MyISAM;

CREATE TABLE IF NOT EXISTS `tblSucursalesDocumentos` (
  `IdSucursalDocumento` int NOT NULL AUTO_INCREMENT,
  `IdSucursal` int NOT NULL,
  `Documento` varchar(255) DEFAULT NULL,
  `Comentarios` text DEFAULT NULL,
  `RutaArchivo` varchar(500) DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdSucursalDocumento`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblSucursalesCostos` (
  `IdSucursal` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `ObjetivoVentas` double DEFAULT NULL,
  `CostoMateriaPrima` double DEFAULT NULL,
  `CostoNomina` double DEFAULT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdSucursal`,`Mes`,`Anio`)
) ENGINE=MyISAM;

CREATE TABLE IF NOT EXISTS `tblPerfilesPropinas` (
  `IdPerfilPropina` int NOT NULL AUTO_INCREMENT,
  `PerfilPropina` varchar(145) DEFAULT NULL,
  `EsActivo` int DEFAULT 1,
  `FechaAct` datetime DEFAULT NULL,
  `Status` int DEFAULT '0',
  PRIMARY KEY (`IdPerfilPropina`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblPerfilesPropinasIngresos` (
  `IdPerfilPropina` int NOT NULL,
  `IdPuesto` int NOT NULL,
  `Porcentaje` decimal(10,2) DEFAULT 0.00,
  `Monto` decimal(10,2) DEFAULT 0.00,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdPerfilPropina`,`IdPuesto`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblPerfilesPropinasEgresos` (
  `IdPerfilPropinaEgreso` int NOT NULL AUTO_INCREMENT,
  `IdPerfilPropina` int NOT NULL,
  `Concepto` varchar(255) DEFAULT NULL,
  `Porcentaje` decimal(10,2) DEFAULT 0.00,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdPerfilPropinaEgreso`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblPropinasEmpleados` (
  `IdPropinaEmpleado` int NOT NULL AUTO_INCREMENT,
  `IdEmpleado` int NOT NULL,
  `IdSucursal` int NOT NULL,
  `IdTurno` int NOT NULL,
  `Dia` int NOT NULL,
  `Mes` int NOT NULL,
  `Anio` int NOT NULL,
  `IdPerfilPropina` int NOT NULL,
  `Venta` decimal(10,2) DEFAULT 0.00,
  `Porcentaje` decimal(10,2) DEFAULT 0.00,
  `Monto` decimal(10,2) DEFAULT 0.00,
  `MontoPropina` decimal(10,2) DEFAULT 0.00,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdPropinaEmpleado`),
  UNIQUE KEY `unique_tip` (`IdEmpleado`,`IdSucursal`,`IdTurno`,`Dia`,`Mes`,`Anio`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tblSucursalesEmpleados` (
  `IdSucursal` int NOT NULL,
  `IdEmpleado` int NOT NULL,
  `FechaAct` datetime DEFAULT NULL,
  PRIMARY KEY (`IdSucursal`, `IdEmpleado`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

INSERT INTO tblSucursales(Sucursal, Status, FechaAct)
VALUES('Branch', 0, Now());
